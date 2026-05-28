"use client";

import { useEffect, useRef, useState } from "react";
import type { StoredTransaction } from "@/lib/helius/types";

type Action = StoredTransaction["action"];

interface BlacklistEntry {
  mint: string;
  symbol: string | null;
  addedAt: number;
}

interface Props {
  activeFilters: Set<Action>;
  onToggleFilter: (action: Action) => void;
}

const ACTION_FILTERS: { action: Action; label: string; onClass: string }[] = [
  { action: "BUY",     label: "Buy",     onClass: "border-emerald-400 text-emerald-300 bg-emerald-400/10" },
  { action: "SELL",    label: "Sell",    onClass: "border-red-400 text-red-300 bg-red-400/10" },
  { action: "SEND",    label: "Send",    onClass: "border-slate-400 text-slate-300 bg-slate-400/10" },
  { action: "RECEIVE", label: "Receive", onClass: "border-blue-400 text-blue-300 bg-blue-400/10" },
];

export default function SettingsPanel({ activeFilters, onToggleFilter }: Props) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<BlacklistEntry[]>([]);
  const [mint, setMint] = useState("");
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  async function fetchList() {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setList(data.blacklist ?? []);
  }

  useEffect(() => {
    if (open) fetchList();
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function openPopover() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Anchor top to the button, place popover's left edge 16px right of the button's right edge.
      // CSS `right` = viewport width - desired left edge - popover width (288px = w-72).
      const desiredLeft = rect.right + 16;
      const popoverWidth = 288;
      const cssRight = Math.max(8, window.innerWidth - desiredLeft - popoverWidth);
      setPopoverPos({ top: rect.top, right: cssRight });
    }
    setOpen((v) => !v);
  }

  async function addToken() {
    if (!mint.trim()) return;
    setLoading(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mint: mint.trim(), symbol: symbol.trim() || undefined }),
    });
    setMint("");
    setSymbol("");
    await fetchList();
    setLoading(false);
  }

  async function removeToken(m: string) {
    await fetch("/api/settings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mint: m }),
    });
    await fetchList();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={openPopover}
        className={`text-xs border px-3 py-1.5 rounded-lg transition-colors ${
          open
            ? "text-white border-slate-500 bg-slate-800"
            : "text-slate-400 hover:text-white border-slate-700 hover:border-slate-500"
        }`}
      >
        ⚙ Filters
      </button>

      {open && (
        <div
          className="fixed w-72 z-50 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-black/60 overflow-hidden"
          style={{
            top: popoverPos.top,
            right: popoverPos.right,
            animation: "popover-in 0.15s ease-out",
          }}
        >
          {/* Arrow pointing left toward the button */}
          <div className="absolute top-3 -left-[5px] w-2.5 h-2.5 rotate-45 bg-slate-900 border-l border-b border-white/10" />

          <div className="p-4">
            {/* Transaction type filters */}
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2.5">
              Show
            </p>
            <div className="flex gap-1.5 flex-wrap mb-4">
              {ACTION_FILTERS.map(({ action, label, onClass }) => {
                const on = activeFilters.has(action);
                return (
                  <button
                    key={action}
                    onClick={() => onToggleFilter(action)}
                    className={`
                      relative h-7 px-3 rounded-full border text-xs font-medium
                      flex items-center gap-1.5 transition-all duration-150 select-none
                      ${on ? onClass : "border-slate-700 text-slate-600 bg-transparent hover:border-slate-600 hover:text-slate-500"}
                    `}
                  >
                    <span className={`w-1 h-1 rounded-full ${on ? "bg-current" : "bg-slate-700"}`} />
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-white/5 mb-4" />

            {/* Blacklist */}
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2.5">
              Token Blacklist
            </p>
            <p className="text-xs text-slate-600 mb-3">
              Ignored — no alerts, no feed entries.
            </p>

            <div className="flex gap-1.5 mb-3">
              <input
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToken()}
                placeholder="Token mint address"
                className="flex-1 bg-slate-800/80 border border-white/8 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-500 placeholder:text-slate-600 min-w-0"
              />
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="Symbol"
                className="w-16 bg-slate-800/80 border border-white/8 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-500 placeholder:text-slate-600"
              />
              <button
                onClick={addToken}
                disabled={loading || !mint.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
              >
                Add
              </button>
            </div>

            <div className="space-y-1 max-h-40 overflow-y-auto">
              {list.length === 0 ? (
                <p className="text-slate-700 text-xs text-center py-3">No tokens blacklisted</p>
              ) : (
                list.map((entry) => (
                  <div
                    key={entry.mint}
                    className="flex items-center justify-between bg-slate-800/60 rounded-lg px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {entry.symbol && (
                        <span className="text-white text-xs font-medium shrink-0">${entry.symbol}</span>
                      )}
                      <span className="text-slate-500 font-mono text-xs truncate">
                        {entry.mint.slice(0, 6)}…{entry.mint.slice(-4)}
                      </span>
                    </div>
                    <button
                      onClick={() => removeToken(entry.mint)}
                      className="text-slate-600 hover:text-red-400 text-xs ml-2 transition-colors shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes popover-in {
          from { opacity: 0; transform: translateX(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
