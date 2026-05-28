import axios from "axios";
import { parseEnhancedTransaction } from "./parser";
import { enrichTransaction } from "@/lib/enricher";
import { getSolPrice } from "@/lib/sol-price";
import { insertTransaction, isBlacklisted, getWalletNameMap } from "@/lib/db";
import { eventBus } from "@/lib/event-bus";
import type { EnhancedTransaction } from "./types";

const HISTORY_API = "https://api.helius.xyz/v0/addresses";
const WINDOW_SECONDS = 24 * 60 * 60;
const PAGE_LIMIT = 100;

export async function backfillWallet(address: string): Promise<void> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    console.warn("[history] HELIUS_API_KEY not set — skipping backfill");
    return;
  }

  console.log(`[history] starting 24h backfill for ${address}`);
  const cutoff = Math.floor(Date.now() / 1000) - WINDOW_SECONDS;
  const solPrice = await getSolPrice();
  const walletNames = getWalletNameMap();

  let before: string | undefined = undefined;
  let done = false;
  let count = 0;

  while (!done) {
    // Helius expects separate query params for multiple types, not comma-separated
    const url = `${HISTORY_API}/${address}/transactions`;
    const params: Record<string, unknown> = {
      "api-key": apiKey,
      limit: PAGE_LIMIT,
    };
    if (before) params.before = before;

    let txs: EnhancedTransaction[];
    try {
      const res = await axios.get(url, { params, timeout: 15_000 });
      txs = Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      console.error("[history] fetch error for", address, err);
      break;
    }

    if (txs.length === 0) break;

    for (const tx of txs) {
      if (tx.timestamp < cutoff) {
        done = true;
        break;
      }

      try {
        const parsed = parseEnhancedTransaction(tx, walletNames);
        if (!parsed) continue;
        if (isBlacklisted(parsed.tokenMint)) continue;

        const stored = await enrichTransaction(parsed, solPrice);
        insertTransaction(stored); // INSERT OR IGNORE — safe to replay
        eventBus.emitTransaction(stored);
        count++;
      } catch (err) {
        console.error("[history] error on", tx.signature, err);
      }
    }

    if (!done && txs.length === PAGE_LIMIT) {
      before = txs[txs.length - 1].signature;
    } else {
      done = true;
    }
  }

  console.log(`[history] backfill done for ${address} — ${count} transactions loaded`);
}
