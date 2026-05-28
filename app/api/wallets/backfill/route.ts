import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { backfillWallet } from "@/lib/helius/history";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { address } = await req.json();
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  // Delete existing transactions so backfill can re-parse them with the current parser
  const db = getDb();
  const deleted = db.prepare("DELETE FROM transactions WHERE wallet_address = ?").run(address);

  backfillWallet(address).catch((err) =>
    console.error("[backfill] error:", err)
  );

  return NextResponse.json({ ok: true, deleted: deleted.changes });
}
