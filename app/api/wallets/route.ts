import { NextRequest, NextResponse } from "next/server";
import { getWallets, addWallet, deleteWallet, walletExists } from "@/lib/db";
import { syncWebhook } from "@/lib/helius/webhook-manager";
import { backfillWallet } from "@/lib/helius/history";
import { PublicKey } from "@solana/web3.js";

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const { oldAddress, newAddress, name } = await req.json();

  if (!oldAddress || typeof oldAddress !== "string") {
    return NextResponse.json({ error: "oldAddress is required" }, { status: 400 });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!walletExists(oldAddress.trim())) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  const cleanOld = oldAddress.trim();
  const cleanNew = newAddress?.trim() ?? cleanOld;

  if (cleanNew !== cleanOld && !isValidSolanaAddress(cleanNew)) {
    return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
  }
  if (cleanNew !== cleanOld && walletExists(cleanNew)) {
    return NextResponse.json({ error: "New address is already tracked" }, { status: 409 });
  }

  // Address changed: delete old, insert new
  if (cleanNew !== cleanOld) {
    deleteWallet(cleanOld);
    addWallet(cleanNew, name.trim());
    backfillWallet(cleanNew).catch((err) =>
      console.error("[wallets] backfill error:", err)
    );
  } else {
    // Name-only update — addWallet does INSERT OR REPLACE
    addWallet(cleanOld, name.trim());
  }

  let warning: string | undefined;
  try {
    await syncWebhook();
  } catch (err) {
    warning = `Saved but Helius webhook sync failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json(
    { ok: true, ...(warning ? { warning } : {}) },
    { status: warning ? 207 : 200 }
  );
}

export const dynamic = "force-dynamic";

function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ wallets: getWallets() });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { address, name } = await req.json();

  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!isValidSolanaAddress(address.trim())) {
    return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
  }
  if (walletExists(address.trim())) {
    return NextResponse.json({ error: "Wallet already tracked" }, { status: 409 });
  }

  const cleanAddress = address.trim();
  addWallet(cleanAddress, name.trim());

  // Always start backfill regardless of webhook sync result
  backfillWallet(cleanAddress).catch((err) =>
    console.error("[wallets] backfill error:", err)
  );

  let warning: string | undefined;
  try {
    await syncWebhook();
  } catch (err) {
    warning = `Wallet saved but Helius webhook sync failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json(
    { ok: true, ...(warning ? { warning } : {}) },
    { status: warning ? 207 : 200 }
  );
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { address } = await req.json();

  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  if (!walletExists(address)) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  deleteWallet(address);

  try {
    await syncWebhook();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: true, warning: `Wallet removed but Helius sync failed: ${msg}` },
      { status: 207 }
    );
  }

  return NextResponse.json({ ok: true });
}
