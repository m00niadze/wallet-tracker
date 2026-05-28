"use client";

import { useState } from "react";
import Link from "next/link";
import TransactionFeed from "./TransactionFeed";
import SettingsPanel from "./SettingsPanel";
import type { StoredTransaction } from "@/lib/helius/types";

type Action = StoredTransaction["action"];

interface Props {
  initialTxs: StoredTransaction[];
  walletNames: string[];
  walletCount: number;
}

export default function TrackerApp({ initialTxs, walletNames, walletCount }: Props) {
  const [activeFilters, setActiveFilters] = useState<Set<Action>>(
    new Set(["BUY", "SELL", "SEND", "RECEIVE"])
  );

  function toggleFilter(action: Action) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(action) ? next.delete(action) : next.add(action);
      return next;
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Wallet Tracker</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {walletCount} wallet{walletCount !== 1 ? "s" : ""} tracked
            {walletNames.length > 0 && <> &mdash; {walletNames.join(", ")}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/wallets"
            className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Wallets
          </Link>
          <SettingsPanel activeFilters={activeFilters} onToggleFilter={toggleFilter} />
        </div>
      </div>
      <TransactionFeed initialTxs={initialTxs} activeFilters={activeFilters} />
    </>
  );
}
