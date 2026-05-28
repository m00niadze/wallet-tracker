import { NextRequest, NextResponse } from "next/server";
import { parseEnhancedTransaction } from "@/lib/helius/parser";
import { enrichTransaction } from "@/lib/enricher";
import { getSolPrice } from "@/lib/sol-price";
import {
  insertTransaction,
  insertRawEvent,
  markEventProcessed,
  isBlacklisted,
  getWalletNameMap,
} from "@/lib/db";
import { sendAlert } from "@/lib/telegram";
import { eventBus } from "@/lib/event-bus";
import type { EnhancedTransaction } from "@/lib/helius/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify webhook secret
  const authHeader = req.headers.get("authorization") ?? req.headers.get("helius-webhook-auth");
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (secret && authHeader !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: EnhancedTransaction[];
  try {
    body = await req.json();
    if (!Array.isArray(body)) body = [body];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Process asynchronously but always return 200 immediately to Helius
  processBatch(body).catch((err) =>
    console.error("[webhook] processBatch error:", err)
  );

  return NextResponse.json({ ok: true });
}

async function processBatch(txs: EnhancedTransaction[]) {
  const solPrice = await getSolPrice();
  const walletNames = getWalletNameMap();

  for (const tx of txs) {
    const rawId = insertRawEvent(tx.signature, JSON.stringify(tx));

    try {
      const parsed = parseEnhancedTransaction(tx, walletNames);
      if (!parsed) {
        markEventProcessed(rawId);
        continue;
      }

      if (isBlacklisted(parsed.tokenMint)) {
        markEventProcessed(rawId);
        continue;
      }

      const stored = await enrichTransaction(parsed, solPrice);
      insertTransaction(stored);
      markEventProcessed(rawId);

      eventBus.emitTransaction(stored);
      await sendAlert(stored);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      markEventProcessed(rawId, msg);
      console.error(`[webhook] failed to process ${tx.signature}:`, err);
    }
  }
}
