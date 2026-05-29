import type {
  EnhancedTransaction,
  ParsedTransaction,
} from "./types";

const LAMPORTS_PER_SOL = 1_000_000_000;
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

const STABLE_SYMBOLS: Record<string, string> = {
  [USDC_MINT]: "USDC",
  [USDT_MINT]: "USDT",
};

function isStable(mint: string): boolean {
  return mint in STABLE_SYMBOLS;
}

export function parseEnhancedTransaction(
  tx: EnhancedTransaction,
  walletNames: Record<string, string>
): ParsedTransaction | null {
  if (tx.transactionError) return null;

  const wallet = findTrackedWallet(tx, walletNames);
  if (!wallet) return null;

  if (tx.type === "SWAP" || tx.events?.swap) {
    return parseSwap(tx, wallet.address, wallet.name);
  }

  if (tx.type === "TRANSFER") {
    return parseTransfer(tx, wallet.address, wallet.name);
  }

  if (tx.tokenTransfers?.length > 0 || tx.nativeTransfers?.length > 0) {
    return parseTransfer(tx, wallet.address, wallet.name);
  }

  return null;
}

function findTrackedWallet(
  tx: EnhancedTransaction,
  walletNames: Record<string, string>
): { address: string; name: string } | null {
  const candidates = new Set<string>();
  candidates.add(tx.feePayer);
  for (const t of tx.nativeTransfers ?? []) {
    candidates.add(t.fromUserAccount);
    candidates.add(t.toUserAccount);
  }
  for (const t of tx.tokenTransfers ?? []) {
    candidates.add(t.fromUserAccount);
    candidates.add(t.toUserAccount);
  }
  for (const address of candidates) {
    if (walletNames[address]) {
      return { address, name: walletNames[address] };
    }
  }
  return null;
}

/**
 * Real SOL movement for the wallet, excluding the tx fee.
 * Fee-payer's nativeBalanceChange includes the fee, so we add it back.
 * Result: ~0 means only a fee was paid (no SOL swap).
 */
function getWalletRealSolChange(tx: EnhancedTransaction, walletAddress: string): number {
  const data = tx.accountData?.find((a) => a.account === walletAddress);
  if (!data) return 0;
  const feeOffset = tx.feePayer === walletAddress ? tx.fee : 0;
  return (data.nativeBalanceChange + feeOffset) / LAMPORTS_PER_SOL;
}

// ─── Swap parsing ─────────────────────────────────────────────────────────────
//
// Strategy: compute NET token balance change for the wallet across all
// tokenTransfers. This is exactly what Solscan's "Key Actions" shows —
// the wallet sent X of token A and received Y of token B, regardless of
// how many internal hops the router used.
//
// Example: 52.05 USDC → DFlow → (USDC→WSOL→JLP→WSOL→MANIFEST) → wallet
//   netChanges: USDC -52.05, MANIFEST +2376  →  BUY MANIFEST with 52.05 USDC ✓
//
// Example: 0.495 SOL → Pump.fun → (SOL→USDC→token) → wallet
//   netChanges: token +31432  (USDC net ≈ 0, it was a pass-through)
//   realSolChange: -0.495  →  BUY token with 0.495 SOL ✓

function parseSwap(
  tx: EnhancedTransaction,
  walletAddress: string,
  walletName: string
): ParsedTransaction | null {
  const transfers = tx.tokenTransfers ?? [];

  // Net token change for the wallet per mint
  const netChanges = new Map<string, number>();
  for (const t of transfers) {
    if (t.fromUserAccount === walletAddress) {
      netChanges.set(t.mint, (netChanges.get(t.mint) ?? 0) - t.tokenAmount);
    }
    if (t.toUserAccount === walletAddress) {
      netChanges.set(t.mint, (netChanges.get(t.mint) ?? 0) + t.tokenAmount);
    }
  }

  // Tokens the wallet NET received (positive, excluding WSOL)
  const netReceived = [...netChanges.entries()]
    .filter(([mint, amt]) => amt > 0.000001 && mint !== WSOL_MINT)
    .sort(([, a], [, b]) => b - a); // largest first

  // Tokens the wallet NET spent (negative, excluding WSOL)
  const netSpent = [...netChanges.entries()]
    .filter(([mint, amt]) => amt < -0.000001 && mint !== WSOL_MINT)
    .sort(([, a], [, b]) => a - b); // most negative first

  const realSolChange = getWalletRealSolChange(tx, walletAddress);
  const solSpent    = realSolChange < -0.000001 ? -realSolChange : null;
  const solReceived = realSolChange >  0.000001 ?  realSolChange : null;

  // BUY: wallet net-received a non-stable token
  const receivedAsset = netReceived.find(([mint]) => !isStable(mint));
  if (receivedAsset) {
    const [tokenMint, tokenAmount] = receivedAsset;
    const spentStableEntry = netSpent.find(([mint]) => isStable(mint));
    // Token-for-token: paid with another non-stable token (not SOL, not stable)
    const spentTokenEntry = !spentStableEntry && !solSpent
      ? netSpent.find(([mint]) => !isStable(mint) && mint !== tokenMint)
      : null;
    return {
      signature: tx.signature,
      walletAddress,
      walletName,
      action: "BUY",
      txType: "SWAP",
      tokenMint,
      tokenAmount,
      spentSol: spentStableEntry || spentTokenEntry ? null : solSpent,
      spentStable: spentStableEntry ? -spentStableEntry[1] : null,
      spentStableSymbol: spentStableEntry ? (STABLE_SYMBOLS[spentStableEntry[0]] ?? null) : null,
      spentTokenMint: spentTokenEntry ? spentTokenEntry[0] : null,
      spentTokenAmount: spentTokenEntry ? -spentTokenEntry[1] : null,
      dexSource: tx.source ?? "UNKNOWN",
      blockTime: tx.timestamp,
    };
  }

  // SELL: wallet net-sent a non-stable token
  const sentAsset = netSpent.find(([mint]) => !isStable(mint));
  if (sentAsset) {
    const [tokenMint, tokenAmount] = sentAsset;
    const receivedStableEntry = netReceived.find(([mint]) => isStable(mint));
    // Token-for-token: received another non-stable token instead of SOL/stable
    const receivedTokenEntry = !receivedStableEntry && !solReceived
      ? netReceived.find(([mint]) => !isStable(mint) && mint !== tokenMint)
      : null;
    return {
      signature: tx.signature,
      walletAddress,
      walletName,
      action: "SELL",
      txType: "SWAP",
      tokenMint,
      tokenAmount: -tokenAmount,
      spentSol: receivedStableEntry || receivedTokenEntry ? null : solReceived,
      spentStable: receivedStableEntry ? receivedStableEntry[1] : null,
      spentStableSymbol: receivedStableEntry ? (STABLE_SYMBOLS[receivedStableEntry[0]] ?? null) : null,
      spentTokenMint: receivedTokenEntry ? receivedTokenEntry[0] : null,
      spentTokenAmount: receivedTokenEntry ? receivedTokenEntry[1] : null,
      dexSource: tx.source ?? "UNKNOWN",
      blockTime: tx.timestamp,
    };
  }

  return null;
}

// ─── Transfer parsing ─────────────────────────────────────────────────────────

function parseTransfer(
  tx: EnhancedTransaction,
  walletAddress: string,
  walletName: string
): ParsedTransaction | null {
  const tokenSent = tx.tokenTransfers?.find(
    (t) => t.fromUserAccount === walletAddress && t.mint !== WSOL_MINT
  );
  if (tokenSent) {
    return {
      signature: tx.signature,
      walletAddress,
      walletName,
      action: "SEND",
      txType: "TRANSFER",
      tokenMint: tokenSent.mint,
      tokenAmount: tokenSent.tokenAmount,
      spentSol: null,
      spentStable: null,
      spentStableSymbol: null,
      spentTokenMint: null,
      spentTokenAmount: null,
      dexSource: tx.source ?? "SYSTEM_PROGRAM",
      blockTime: tx.timestamp,
    };
  }

  const tokenReceived = tx.tokenTransfers?.find(
    (t) => t.toUserAccount === walletAddress && t.mint !== WSOL_MINT
  );
  if (tokenReceived) {
    return {
      signature: tx.signature,
      walletAddress,
      walletName,
      action: "RECEIVE",
      txType: "TRANSFER",
      tokenMint: tokenReceived.mint,
      tokenAmount: tokenReceived.tokenAmount,
      spentSol: null,
      spentStable: null,
      spentStableSymbol: null,
      spentTokenMint: null,
      spentTokenAmount: null,
      dexSource: tx.source ?? "SYSTEM_PROGRAM",
      blockTime: tx.timestamp,
    };
  }

  const solChange = getWalletRealSolChange(tx, walletAddress);
  if (solChange < -0.000001) {
    const solSent = -solChange;
    return {
      signature: tx.signature,
      walletAddress,
      walletName,
      action: "SEND",
      txType: "TRANSFER",
      tokenMint: WSOL_MINT,
      tokenAmount: solSent,
      spentSol: solSent,
      spentStable: null,
      spentStableSymbol: null,
      spentTokenMint: null,
      spentTokenAmount: null,
      dexSource: tx.source ?? "SYSTEM_PROGRAM",
      blockTime: tx.timestamp,
    };
  }

  if (solChange > 0.000001) {
    return {
      signature: tx.signature,
      walletAddress,
      walletName,
      action: "RECEIVE",
      txType: "TRANSFER",
      tokenMint: WSOL_MINT,
      tokenAmount: solChange,
      spentSol: null,
      spentStable: null,
      spentStableSymbol: null,
      spentTokenMint: null,
      spentTokenAmount: null,
      dexSource: tx.source ?? "SYSTEM_PROGRAM",
      blockTime: tx.timestamp,
    };
  }

  return null;
}
