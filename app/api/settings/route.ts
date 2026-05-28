import { NextRequest, NextResponse } from "next/server";
import { getBlacklist, addToBlacklist, removeFromBlacklist } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ blacklist: getBlacklist() });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { mint, symbol } = await req.json();
  if (!mint || typeof mint !== "string") {
    return NextResponse.json({ error: "mint is required" }, { status: 400 });
  }
  addToBlacklist(mint, symbol);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { mint } = await req.json();
  if (!mint || typeof mint !== "string") {
    return NextResponse.json({ error: "mint is required" }, { status: 400 });
  }
  removeFromBlacklist(mint);
  return NextResponse.json({ ok: true });
}
