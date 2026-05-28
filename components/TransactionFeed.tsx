"use client";

import { useEffect, useRef, useState } from "react";
import TransactionCard from "./TransactionCard";
import type { StoredTransaction } from "@/lib/helius/types";

type Action = StoredTransaction["action"];

interface Props {
  initialTxs: StoredTransaction[];
  activeFilters: Set<Action>;
}

export default function TransactionFeed({ initialTxs, activeFilters }: Props) {
  const [txs, setTxs] = useState<StoredTransaction[]>(initialTxs);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/events");
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (e) => {
      try {
        const tx: StoredTransaction = JSON.parse(e.data);
        setTxs((prev) => [tx, ...prev].slice(0, 500));
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setConnected(false);
      setError("Disconnected — retrying...");
    };

    return () => {
      es.close();
    };
  }, []);

  const visible = txs.filter((tx) => activeFilters.has(tx.action));

  return (
    <div>
      {/* Status bar */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`}
        />
        <span className="text-xs text-slate-500">
          {connected ? "Live" : error ?? "Connecting..."}
        </span>
        <span className="text-xs text-slate-600 ml-auto">{visible.length} transactions</span>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-20 text-slate-600">
          <p className="text-4xl mb-3">👀</p>
          <p className="text-sm">
            {txs.length === 0 ? "Waiting for transactions..." : "No transactions match the current filters."}
          </p>
          {txs.length === 0 && (
            <p className="text-xs mt-1">Make sure your wallets are set in <code className="font-mono">config/wallets.ts</code></p>
          )}
        </div>
      ) : (
        <div>
          {visible.map((tx) => (
            <TransactionCard key={tx.signature} tx={tx} />
          ))}
        </div>
      )}
    </div>
  );
}
