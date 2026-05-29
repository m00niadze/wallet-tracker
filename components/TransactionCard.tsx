"use client";

import type { StoredTransaction } from "@/lib/helius/types";

function formatMarketCap(mc: number | null): string {
  if (mc == null) return "N/A";
  if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(2)}B`;
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
  return `$${mc.toFixed(0)}`;
}

function formatAmount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(n < 1 ? 6 : 4);
}

function formatPrice(p: number | null): string {
  if (p == null) return "N/A";
  if (p < 0.000001) return `$${p.toExponential(3)}`;
  if (p < 0.01) return `$${p.toPrecision(4)}`;
  return `$${p.toFixed(4)}`;
}

function timeAgo(blockTime: number): string {
  const diff = Math.floor(Date.now() / 1000) - blockTime;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ACTION_STYLES: Record<StoredTransaction["action"], string> = {
  BUY:     "bg-emerald-500/10 backdrop-blur-sm border-emerald-500/30 text-emerald-400",
  SELL:    "bg-red-500/10 backdrop-blur-sm border-red-500/30 text-red-400",
  SEND:    "bg-slate-500/10 backdrop-blur-sm border-slate-500/30 text-slate-400",
  RECEIVE: "bg-blue-500/10 backdrop-blur-sm border-blue-500/30 text-blue-400",
};

const ACTION_BADGE: Record<StoredTransaction["action"], string> = {
  BUY:     "bg-emerald-500/20 text-emerald-300",
  SELL:    "bg-red-500/20 text-red-300",
  SEND:    "bg-slate-500/20 text-slate-300",
  RECEIVE: "bg-blue-500/20 text-blue-300",
};

interface Props {
  tx: StoredTransaction;
  onWalletClick?: (address: string, name: string) => void;
}

export default function TransactionCard({ tx, onWalletClick }: Props) {
  const borderClass = ACTION_STYLES[tx.action];
  const badgeClass = ACTION_BADGE[tx.action];
  const tokenLabel = tx.tokenSymbol ? `$${tx.tokenSymbol}` : tx.tokenMint.slice(0, 8) + "...";
  const tokenName = tx.tokenName ?? tokenLabel;
  const shortCa = `${tx.tokenMint.slice(0, 4)}...${tx.tokenMint.slice(-4)}`;

  const spentLine = (() => {
    const usd = tx.spentUsdValue != null ? ` (~$${tx.spentUsdValue.toFixed(0)})` : "";
    if (tx.spentSol != null) return { amount: `${tx.spentSol.toFixed(4)}`, currency: "SOL", usd };
    if (tx.spentStable != null) return { amount: `${tx.spentStable.toFixed(2)}`, currency: tx.spentStableSymbol ?? "stable", usd: "" };
    return null;
  })();

  return (
    <div className={`rounded-xl border p-4 ${borderClass} mb-3 transition-all hover:scale-[1.005]`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
            {tx.action}
          </span>
          {onWalletClick ? (
            <button
              onClick={() => onWalletClick(tx.walletAddress, tx.walletName)}
              className="text-sm font-semibold text-white hover:text-emerald-300 transition-colors underline-offset-2 hover:underline"
            >
              {tx.walletName}
            </button>
          ) : (
            <span className="text-sm font-semibold text-white">{tx.walletName}</span>
          )}
          {tx.txType === "SWAP" && (
            <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
              {tx.dexSource}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">{timeAgo(tx.blockTime)}</span>
      </div>

      {/* Token row */}
      <div className="mb-2">
        <span className="text-white font-semibold">{tokenName}</span>
        {tx.tokenSymbol && (
          <span className="text-slate-400 text-sm ml-1">({tokenLabel})</span>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
        {spentLine && (
          <>
            <span className="text-slate-500">
              {tx.action === "SELL" ? "Received" : "Spent"} ({spentLine.currency})
            </span>
            <span className="text-white">{spentLine.amount}{spentLine.usd}</span>
          </>
        )}
        <span className="text-slate-500">
          {tx.action === "BUY" ? "Received" : tx.action === "SELL" ? "Sold" : "Amount"}
        </span>
        <span className="text-white">
          {formatAmount(tx.tokenAmount)} {tx.tokenSymbol ?? ""}
        </span>
        <span className="text-slate-500">Price</span>
        <span className="text-white">{formatPrice(tx.priceUsd)}</span>
        <span className="text-slate-500">Market Cap</span>
        <span className="text-white">{formatMarketCap(tx.marketCap)}</span>
      </div>

      {/* Contract address */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-slate-500 text-xs">CA</span>
        <a
          href={`https://solscan.io/token/${tx.tokenMint}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-slate-300 hover:text-white transition-colors"
          title={tx.tokenMint}
        >
          {shortCa}
        </a>
        <button
          onClick={() => navigator.clipboard.writeText(tx.tokenMint)}
          className="text-slate-600 hover:text-slate-300 text-xs transition-colors"
          title="Copy full address"
        >
          ⧉
        </button>
      </div>

      {/* Links */}
      <div className="flex gap-3">
        {tx.dexscreenerUrl && (
          <a
            href={tx.dexscreenerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            📊 DexScreener
          </a>
        )}
        {tx.axiomUrl && (
          <a
            href={tx.axiomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            🔮 Axiom
          </a>
        )}
        <a
          href={`https://solscan.io/tx/${tx.signature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
        >
          🔍 Solscan
        </a>
        {tx.dexSource?.toUpperCase().includes("PUMP") && (
          <a
            href={`https://pump.fun/coin/${tx.tokenMint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            🎃 Pump.fun
          </a>
        )}
      </div>
    </div>
  );
}
