import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getDb } from "@/lib/db";
import { getSolPrice } from "@/lib/sol-price";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

interface TokenInfo {
  mint: string;
  uiAmount: number;
}

interface DexPair {
  chainId: string;
  priceUsd: string;
  baseToken: { address: string; symbol: string; name: string };
  liquidity?: { usd: number };
}

interface PriceInfo {
  priceUsd: number;
  name: string;
  symbol: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchPrices(mints: string[]): Promise<Map<string, PriceInfo>> {
  const map = new Map<string, PriceInfo>();
  if (mints.length === 0) return map;
  const batches = chunk(mints, 30);
  await Promise.all(
    batches.map(async (batch) => {
      try {
        const res = await axios.get(
          `https://api.dexscreener.com/latest/dex/tokens/${batch.join(",")}`,
          { timeout: 8000 }
        );
        const pairs: DexPair[] = res.data?.pairs ?? [];
        const solPairs = pairs
          .filter((p) => p.chainId === "solana")
          .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
        const seen = new Set<string>();
        for (const p of solPairs) {
          const addr = p.baseToken.address;
          if (!seen.has(addr)) {
            seen.add(addr);
            map.set(addr, {
              priceUsd: parseFloat(p.priceUsd) || 0,
              name: p.baseToken.name,
              symbol: p.baseToken.symbol,
            });
          }
        }
      } catch {
        // partial failure — skip batch
      }
    })
  );
  return map;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "HELIUS_API_KEY not configured" }, { status: 500 });

  // ── 1. Wallet name from DB ──────────────────────────────────────────────────
  const db = getDb();
  const walletRow = db.prepare("SELECT name FROM wallets WHERE address = ?").get(address) as
    | { name: string }
    | undefined;
  const walletName = walletRow?.name ?? address.slice(0, 8) + "...";

  // ── 2. Live balances via Solana RPC ────────────────────────────────────────
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

  async function rpc(method: string, params: unknown[]) {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const json = await res.json();
    return json.result;
  }

  async function getTokensForProgram(programId: string): Promise<TokenInfo[]> {
    try {
      const result = await rpc("getTokenAccountsByOwner", [
        address,
        { programId },
        { encoding: "jsonParsed" },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (result?.value ?? []).map((acc: any) => {
        const info = acc.account?.data?.parsed?.info;
        return {
          mint: info?.mint as string,
          uiAmount: (info?.tokenAmount?.uiAmount as number) ?? 0,
        };
      }).filter((t: TokenInfo) => t.mint && t.uiAmount > 0);
    } catch {
      return [];
    }
  }

  const [solResult, splTokens, token2022Tokens] = await Promise.all([
    rpc("getBalance", [address]).catch(() => null),
    getTokensForProgram(SPL_TOKEN_PROGRAM),
    getTokensForProgram(TOKEN_2022_PROGRAM),
  ]);

  const solPrice = await getSolPrice();
  const solBalance = ((solResult?.value as number) ?? 0) / 1e9;
  const allTokens: TokenInfo[] = [...splTokens, ...token2022Tokens];

  const usdcBalance = allTokens.find((t) => t.mint === USDC_MINT)?.uiAmount ?? 0;
  const usdtBalance = allTokens.find((t) => t.mint === USDT_MINT)?.uiAmount ?? 0;

  // ── 3. All DB transactions for this wallet ──────────────────────────────────
  const rows = db
    .prepare(
      "SELECT action, token_mint, token_name, token_symbol, token_amount, spent_usd_value, block_time FROM transactions WHERE wallet_address = ? ORDER BY block_time ASC"
    )
    .all(address) as {
    action: string;
    token_mint: string;
    token_name: string | null;
    token_symbol: string | null;
    token_amount: number;
    spent_usd_value: number | null;
    block_time: number;
  }[];

  // ── 4. Aggregate per-mint stats from DB ─────────────────────────────────────
  interface MintStats {
    totalBought: number;
    totalSold: number;
    totalSpentUsd: number;
    totalReceivedUsd: number;
    tokenName: string | null;
    tokenSymbol: string | null;
  }
  const mintStats = new Map<string, MintStats>();

  for (const row of rows) {
    if (!mintStats.has(row.token_mint)) {
      mintStats.set(row.token_mint, {
        totalBought: 0,
        totalSold: 0,
        totalSpentUsd: 0,
        totalReceivedUsd: 0,
        tokenName: null,
        tokenSymbol: null,
      });
    }
    const s = mintStats.get(row.token_mint)!;
    if (row.token_name) s.tokenName = row.token_name;
    if (row.token_symbol) s.tokenSymbol = row.token_symbol;
    if (row.action === "BUY") {
      s.totalBought += row.token_amount;
      s.totalSpentUsd += row.spent_usd_value ?? 0;
    } else if (row.action === "SELL") {
      s.totalSold += row.token_amount;
      s.totalReceivedUsd += row.spent_usd_value ?? 0;
    }
  }

  // ── 5. Collect all mints that need prices ───────────────────────────────────
  const chainTokenMints = allTokens
    .filter((t) => t.mint !== USDC_MINT && t.mint !== USDT_MINT && t.mint !== WSOL_MINT)
    .map((t) => t.mint);

  const dbActiveMints = [...mintStats.entries()]
    .filter(([, s]) => s.totalBought - s.totalSold > 0.0001)
    .map(([mint]) => mint)
    .filter((m) => m !== USDC_MINT && m !== USDT_MINT && m !== WSOL_MINT);

  const last24h = Math.floor(Date.now() / 1000) - 86400;
  const buys24Mints = rows
    .filter((r) => r.action === "BUY" && r.block_time > last24h)
    .map((r) => r.token_mint);

  const allPriceMints = [
    ...new Set([...chainTokenMints, ...dbActiveMints, ...buys24Mints]),
  ];

  const priceMap = await fetchPrices(allPriceMints);

  // ── 6. Active positions (using chain balances as source of truth) ────────────
  // PNL formula: totalPnl = currentValue + totalReceivedUsd - totalSpentUsd
  // This works even when sells > tracked buys (untracked history), no avg-cost needed.
  const activePositions = allTokens
    .filter((t) => t.mint !== USDC_MINT && t.mint !== USDT_MINT && t.mint !== WSOL_MINT)
    .map((t) => {
      const amount = t.uiAmount;
      if (amount < 0.0001) return null;
      const price = priceMap.get(t.mint);
      const currentPrice = price?.priceUsd ?? 0;
      if (amount * currentPrice < 1) return null; // filter dust / scam tokens under $1
      const dbData = mintStats.get(t.mint);
      const currentValue = amount * currentPrice;
      const totalSpentUsd = dbData?.totalSpentUsd ?? 0;
      const totalReceivedUsd = dbData?.totalReceivedUsd ?? 0;
      const totalPnl = totalSpentUsd > 0
        ? currentValue + totalReceivedUsd - totalSpentUsd
        : 0;
      const totalPnlPct = totalSpentUsd > 0 ? (totalPnl / totalSpentUsd) * 100 : 0;
      return {
        mint: t.mint,
        symbol: price?.symbol ?? dbData?.tokenSymbol ?? null,
        name: price?.name ?? dbData?.tokenName ?? null,
        amount,
        currentPrice,
        currentValue,
        totalPnl,
        totalPnlPct,
        totalBought: dbData?.totalBought ?? 0,
        totalSold: dbData?.totalSold ?? 0,
        totalSpentUsd,
        totalReceivedUsd,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.currentValue - a!.currentValue) as {
    mint: string;
    symbol: string | null;
    name: string | null;
    amount: number;
    currentPrice: number;
    currentValue: number;
    totalPnl: number;
    totalPnlPct: number;
    totalBought: number;
    totalSold: number;
    totalSpentUsd: number;
    totalReceivedUsd: number;
  }[];

  // ── 7. Overall wallet PNL (same formula across all mints) ───────────────────
  const totalSpentAllTime = [...mintStats.values()].reduce((s, m) => s + m.totalSpentUsd, 0);
  const totalReceivedAllTime = [...mintStats.values()].reduce((s, m) => s + m.totalReceivedUsd, 0);
  const totalCurrentPositionValue = activePositions.reduce((s, p) => s + p.currentValue, 0);
  const walletTotalPnl = totalSpentAllTime > 0
    ? totalCurrentPositionValue + totalReceivedAllTime - totalSpentAllTime
    : 0;

  // ── 8. Closed positions — sold tokens no longer held on-chain ──────────────
  const activePositionMints = new Set(activePositions.map((p) => p.mint));
  const closedPositions = [...mintStats.entries()]
    .filter(
      ([mint, s]) =>
        s.totalSold > 0 &&
        !activePositionMints.has(mint) &&
        mint !== USDC_MINT &&
        mint !== USDT_MINT &&
        mint !== WSOL_MINT
    )
    .map(([mint, s]) => {
      const pnl = s.totalReceivedUsd - s.totalSpentUsd;
      const pnlPct = s.totalSpentUsd > 0 ? (pnl / s.totalSpentUsd) * 100 : 0;
      return {
        mint,
        symbol: s.tokenSymbol,
        name: s.tokenName,
        totalBought: s.totalBought,
        totalSold: s.totalSold,
        totalSpentUsd: s.totalSpentUsd,
        totalReceivedUsd: s.totalReceivedUsd,
        pnl,
        pnlPct,
      };
    })
    .sort((a, b) => b.pnl - a.pnl);

  // ── 9. Last 24h buys ─────────────────────────────────────────────────────────
  interface Buy24 {
    totalAmount: number;
    totalSpentUsd: number;
    tokenName: string | null;
    tokenSymbol: string | null;
  }
  const buys24Map = new Map<string, Buy24>();
  for (const row of rows) {
    if (row.action !== "BUY" || row.block_time <= last24h) continue;
    if (!buys24Map.has(row.token_mint)) {
      buys24Map.set(row.token_mint, {
        totalAmount: 0,
        totalSpentUsd: 0,
        tokenName: row.token_name,
        tokenSymbol: row.token_symbol,
      });
    }
    const b = buys24Map.get(row.token_mint)!;
    b.totalAmount += row.token_amount;
    b.totalSpentUsd += row.spent_usd_value ?? 0;
    if (row.token_name) b.tokenName = row.token_name;
    if (row.token_symbol) b.tokenSymbol = row.token_symbol;
  }

  const last24hBuys = [...buys24Map.entries()].map(([mint, b]) => {
    const price = priceMap.get(mint);
    const currentPrice = price?.priceUsd ?? 0;
    const currentValue = b.totalAmount * currentPrice;
    const pnl = currentValue - b.totalSpentUsd;
    const pnlPct = b.totalSpentUsd > 0 ? (pnl / b.totalSpentUsd) * 100 : 0;
    return {
      mint,
      symbol: price?.symbol ?? b.tokenSymbol ?? null,
      name: price?.name ?? b.tokenName ?? null,
      amount: b.totalAmount,
      spentUsd: b.totalSpentUsd,
      currentValue,
      pnl,
      pnlPct,
    };
  });

  // ── 9. Chart data ─────────────────────────────────────────────────────────────
  // Running net cash flow: buys subtract (money out), sells add (money in).
  // A final "now" point adds current holdings so the chart ends at Total PNL.
  let cumFlow = 0;
  const chartData: { timestamp: number; cumulativePnl: number }[] = [];

  for (const row of rows) {
    const usd = row.spent_usd_value ?? 0;
    if (usd <= 0) continue;
    if (row.action === "BUY") {
      cumFlow -= usd;
      chartData.push({ timestamp: row.block_time, cumulativePnl: cumFlow });
    } else if (row.action === "SELL") {
      cumFlow += usd;
      chartData.push({ timestamp: row.block_time, cumulativePnl: cumFlow });
    }
  }

  // Final point: cash flow + current open positions = Total PNL
  const nowTs = Math.floor(Date.now() / 1000);
  chartData.push({ timestamp: nowTs, cumulativePnl: cumFlow + totalCurrentPositionValue });

  // ── 10. Total portfolio USD value ────────────────────────────────────────────
  const positionsUsd = activePositions.reduce((s, p) => s + p.currentValue, 0);
  const totalUsd = solBalance * solPrice + usdcBalance + usdtBalance + positionsUsd;

  return NextResponse.json({
    wallet: { address, name: walletName },
    balances: {
      sol: solBalance,
      solUsd: solBalance * solPrice,
      usdc: usdcBalance,
      usdt: usdtBalance,
      totalUsd,
    },
    activePositions,
    closedPositions,
    last24hBuys,
    pnl: {
      total: walletTotalPnl,
      invested: totalSpentAllTime,
      cashed: totalReceivedAllTime,
    },
    chartData,
  });
}
