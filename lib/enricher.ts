import axios from "axios";
import type { ParsedTransaction, StoredTransaction } from "./helius/types";

interface DexPair {
  chainId: string;
  priceUsd: string;
  marketCap: number | null;
  fdv: number | null;
  baseToken: { address: string; symbol: string; name: string };
  quoteToken: { address: string; symbol: string };
  liquidity?: { usd: number };
  url: string;
}

// In-memory cache: mint -> { data, fetchedAt }
const cache = new Map<string, { data: DexPair | null; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000;

async function fetchDexScreenerData(mint: string): Promise<DexPair | null> {
  const now = Date.now();
  const cached = cache.get(mint);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

  try {
    const res = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { timeout: 5000 }
    );
    const pairs: DexPair[] = res.data?.pairs ?? [];
    const solanaPairs = pairs
      .filter((p) => p.chainId === "solana")
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    const best = solanaPairs[0] ?? null;
    cache.set(mint, { data: best, fetchedAt: now });
    return best;
  } catch {
    cache.set(mint, { data: null, fetchedAt: now });
    return null;
  }
}

export async function enrichTransaction(
  parsed: ParsedTransaction,
  solPriceUsd: number
): Promise<StoredTransaction> {
  const dex = await fetchDexScreenerData(parsed.tokenMint);

  const tokenName = dex?.baseToken.name ?? null;
  const tokenSymbol = dex?.baseToken.symbol ?? null;
  const priceUsd = dex ? parseFloat(dex.priceUsd) : null;
  const marketCap = dex?.marketCap ?? dex?.fdv ?? null;

  const spentUsdValue =
    parsed.spentSol != null
      ? parsed.spentSol * solPriceUsd
      : parsed.spentStable != null
      ? parsed.spentStable
      : null;

  return {
    signature: parsed.signature,
    walletAddress: parsed.walletAddress,
    walletName: parsed.walletName,
    action: parsed.action,
    txType: parsed.txType,
    tokenMint: parsed.tokenMint,
    tokenName,
    tokenSymbol,
    tokenAmount: parsed.tokenAmount,
    spentSol: parsed.spentSol,
    spentStable: parsed.spentStable,
    spentStableSymbol: parsed.spentStableSymbol,
    spentUsdValue,
    priceUsd,
    marketCap,
    dexSource: parsed.dexSource,
    dexscreenerUrl: `https://dexscreener.com/solana/${parsed.tokenMint}`,
    axiomUrl: `https://axiom.trade/meme/${parsed.tokenMint}`,
    blockTime: parsed.blockTime,
    isBlacklisted: 0,
  };
}
