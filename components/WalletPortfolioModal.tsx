"use client";

import { useEffect, useState, useRef } from "react";
import PnlChart from "./PnlChart";

interface Position {
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
}

interface ClosedPosition {
  mint: string;
  symbol: string | null;
  name: string | null;
  totalBought: number;
  totalSold: number;
  totalSpentUsd: number;
  totalReceivedUsd: number;
  pnl: number;
  pnlPct: number;
}

interface Buy24 {
  mint: string;
  symbol: string | null;
  name: string | null;
  amount: number;
  spentUsd: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
}

interface PortfolioData {
  wallet: { address: string; name: string };
  balances: {
    sol: number;
    solUsd: number;
    usdc: number;
    usdt: number;
    totalUsd: number;
  };
  activePositions: Position[];
  closedPositions: ClosedPosition[];
  last24hBuys: Buy24[];
  pnl: { total: number; invested: number; cashed: number };
  chartData: { timestamp: number; cumulativePnl: number }[];
}

interface Props {
  address: string;
  name: string;
  onClose: () => void;
}

function fmtUsd(n: number, alwaysSign = false): string {
  const sign = alwaysSign ? (n >= 0 ? "+" : "") : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${n < 0 ? "-" : ""}$${abs.toFixed(2)}`;
}

function fmtAmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(n < 1 ? 4 : 2);
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function pnlColor(n: number): string {
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-slate-400";
}

function StatChip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-800/80 rounded-xl px-4 py-3 text-center flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <div className="text-white font-semibold text-sm truncate">{value}</div>
      {sub && <div className="text-slate-500 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 h-16 bg-slate-800 rounded-xl" />
        ))}
      </div>
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-14 bg-slate-800 rounded-xl" />
        ))}
      </div>
      <div className="h-40 bg-slate-800 rounded-xl" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-slate-800 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function WalletPortfolioModal({ address, name, onClose }: Props) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/portfolio/${address}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message ?? "Failed to load"); });
    return () => { cancelled = true; };
  }, [address]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-6 px-3"
      style={{ animation: "modal-fade-in 0.15s ease-out" }}
    >
      <div
        className="bg-slate-950/98 border border-slate-700 rounded-2xl w-full max-w-6xl shadow-2xl"
        style={{ animation: "modal-slide-in 0.18s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">{name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-xs text-slate-500">{shortAddr}</span>
              <button
                onClick={() => navigator.clipboard.writeText(address)}
                className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
                title="Copy full address"
              >
                ⧉
              </button>
              <a
                href={`https://solscan.io/account/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
                title="View on Solscan"
              >
                ↗
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {error && (
            <div className="text-red-400 bg-red-500/10 rounded-xl px-4 py-3 text-sm">
              Failed to load portfolio: {error}
            </div>
          )}

          {!data && !error && <Skeleton />}

          {data && (
            <>
              {/* Balances */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Balances</p>
                <div className="flex gap-2 flex-wrap">
                  <StatChip
                    label="SOL"
                    value={`${data.balances.sol.toFixed(3)} SOL`}
                    sub={fmtUsd(data.balances.solUsd)}
                  />
                  <StatChip
                    label="USDC"
                    value={`$${data.balances.usdc.toFixed(2)}`}
                  />
                  <StatChip
                    label="USDT"
                    value={`$${data.balances.usdt.toFixed(2)}`}
                  />
                  <StatChip
                    label="Total Value"
                    value={fmtUsd(data.balances.totalUsd)}
                  />
                </div>
              </div>

              {/* PNL Summary */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">PNL</p>
                <div className="flex gap-2 flex-wrap">
                  <div className="bg-slate-800/80 rounded-xl px-4 py-3 flex-1 min-w-0 text-center">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Invested</div>
                    <div className="font-semibold text-sm text-slate-300">
                      {fmtUsd(data.pnl.invested)}
                    </div>
                  </div>
                  <div className="bg-slate-800/80 rounded-xl px-4 py-3 flex-1 min-w-0 text-center">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Cashed Out</div>
                    <div className="font-semibold text-sm text-slate-300">
                      {fmtUsd(data.pnl.cashed)}
                    </div>
                  </div>
                  <div className="bg-slate-800/80 rounded-xl px-4 py-3 flex-1 min-w-0 text-center">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Total PNL</div>
                    <div className={`font-bold text-base ${pnlColor(data.pnl.total)}`}>
                      {fmtUsd(data.pnl.total, true)}
                    </div>
                    {data.pnl.invested > 0 && (
                      <div className={`text-xs mt-0.5 ${pnlColor(data.pnl.total)}`}>
                        {fmtPct((data.pnl.total / data.pnl.invested) * 100)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                  All-Time PNL
                </p>
                <div className="bg-slate-800/40 rounded-xl px-3 py-3">
                  <PnlChart data={data.chartData} />
                </div>
              </div>

              {/* Last 24h Buys — recent activity only, see Active Positions for full picture */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                  Recent Buys (24h)
                  <span className="ml-2 text-slate-600 normal-case">({data.last24hBuys.length})</span>
                </p>
                {data.last24hBuys.length === 0 ? (
                  <p className="text-slate-600 text-sm py-2">No buys in the last 24 hours</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {data.last24hBuys.map((b) => {
                      const stillHolding = data.activePositions.some((p) => p.mint === b.mint);
                      return (
                        <a
                          key={b.mint}
                          href={`https://dexscreener.com/solana/${b.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-500 rounded-xl px-4 py-3 min-w-[150px] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-1 mb-2">
                            <span className="text-white font-semibold text-sm truncate">
                              {b.symbol ? `$${b.symbol}` : b.name ?? b.mint.slice(0, 6) + "…"}
                            </span>
                            {stillHolding && (
                              <span className="shrink-0 text-[9px] uppercase tracking-wider text-emerald-500 bg-emerald-500/10 rounded px-1.5 py-0.5">
                                holding
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 text-xs">{fmtAmt(b.amount)} tokens</div>
                          <div className="text-slate-400 text-xs mt-0.5">Spent {fmtUsd(b.spentUsd)}</div>
                          {stillHolding && (
                            <div className="text-[10px] text-slate-600 mt-1.5">
                              ↓ see active positions
                            </div>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active + Closed Positions side by side */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                {/* Active Positions */}
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">
                      Active Positions
                      <span className="ml-2 text-slate-600 normal-case">({data.activePositions.length})</span>
                    </p>
                    <span className="text-[9px] text-slate-600">still holding</span>
                  </div>
                  {data.activePositions.length === 0 ? (
                    <p className="text-slate-600 text-sm py-2">No open token positions</p>
                  ) : (
                    <div className="space-y-2">
                      {data.activePositions.map((p) => {
                        const label = p.symbol ? `$${p.symbol}` : p.name ?? p.mint.slice(0, 6) + "…";
                        const hasCost = p.totalSpentUsd > 0;
                        return (
                          <div key={p.mint} className="bg-slate-800/50 hover:bg-slate-800/80 rounded-xl px-4 py-3 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <a
                                  href={`https://dexscreener.com/solana/${p.mint}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-white font-semibold text-sm hover:text-emerald-300 transition-colors truncate"
                                >
                                  {label}
                                </a>
                                {p.name && p.symbol && (
                                  <span className="text-slate-600 text-xs truncate hidden sm:block">{p.name}</span>
                                )}
                              </div>
                              {hasCost && (
                                <div className="text-right shrink-0 ml-2">
                                  <span className={`font-bold text-sm ${pnlColor(p.totalPnl)}`}>
                                    {fmtUsd(p.totalPnl, true)}
                                  </span>
                                  <span className={`ml-1 text-xs ${pnlColor(p.totalPnl)}`}>
                                    ({fmtPct(p.totalPnlPct)})
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 text-xs">
                              <div className="bg-slate-900/60 rounded-lg px-2 py-1.5">
                                <div className="text-slate-500 mb-0.5">Bought</div>
                                <div className="text-slate-200 font-medium">{fmtAmt(p.totalBought)}</div>
                                {hasCost && <div className="text-slate-400">{fmtUsd(p.totalSpentUsd)}</div>}
                              </div>
                              <div className="bg-slate-900/60 rounded-lg px-2 py-1.5">
                                <div className="text-slate-500 mb-0.5">Sold</div>
                                {p.totalSold > 0 ? (
                                  <>
                                    <div className="text-slate-200 font-medium">{fmtAmt(p.totalSold)}</div>
                                    <div className="text-slate-400">{fmtUsd(p.totalReceivedUsd)}</div>
                                  </>
                                ) : (
                                  <div className="text-slate-600 text-[10px]">Nothing yet</div>
                                )}
                              </div>
                              <div className="bg-slate-900/60 rounded-lg px-2 py-1.5">
                                <div className="text-slate-500 mb-0.5">Holding</div>
                                <div className="text-white font-semibold">{fmtUsd(p.currentValue)}</div>
                                <div className="text-slate-400">{fmtAmt(p.amount)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Closed Positions */}
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">
                      Closed Positions
                      <span className="ml-2 text-slate-600 normal-case">({data.closedPositions.length})</span>
                    </p>
                    <span className="text-[9px] text-slate-600">fully exited</span>
                  </div>
                  {data.closedPositions.length === 0 ? (
                    <p className="text-slate-600 text-sm py-2">No fully closed positions</p>
                  ) : (
                    <div className="space-y-2">
                      {data.closedPositions.map((p) => {
                        const label = p.symbol ? `$${p.symbol}` : p.name ?? p.mint.slice(0, 6) + "…";
                        return (
                          <div key={p.mint} className="bg-slate-800/50 hover:bg-slate-800/80 rounded-xl px-4 py-3 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <a
                                  href={`https://dexscreener.com/solana/${p.mint}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-white font-semibold text-sm hover:text-slate-300 transition-colors truncate"
                                >
                                  {label}
                                </a>
                                {p.name && p.symbol && (
                                  <span className="text-slate-600 text-xs truncate hidden sm:block">{p.name}</span>
                                )}
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <span className={`font-bold text-sm ${pnlColor(p.pnl)}`}>
                                  {fmtUsd(p.pnl, true)}
                                </span>
                                {p.totalSpentUsd > 0 && (
                                  <span className={`ml-1 text-xs ${pnlColor(p.pnl)}`}>
                                    ({fmtPct(p.pnlPct)})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                              <div className="bg-slate-900/60 rounded-lg px-2 py-1.5">
                                <div className="text-slate-500 mb-0.5">Bought</div>
                                <div className="text-slate-200 font-medium">{fmtAmt(p.totalBought)}</div>
                                {p.totalSpentUsd > 0 && <div className="text-slate-400">{fmtUsd(p.totalSpentUsd)}</div>}
                              </div>
                              <div className="bg-slate-900/60 rounded-lg px-2 py-1.5">
                                <div className="text-slate-500 mb-0.5">Sold for</div>
                                <div className="text-slate-200 font-medium">{fmtAmt(p.totalSold)}</div>
                                <div className="text-slate-400">{fmtUsd(p.totalReceivedUsd)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </>
          )}
        </div>

        <style>{`
          @keyframes modal-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes modal-slide-in {
            from { opacity: 0; transform: translateY(12px) scale(0.98); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}
