import { NextRequest, NextResponse } from "next/server";
import { getRecentTransactions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const transactions = getRecentTransactions(limit, offset);
  return NextResponse.json({ transactions, limit, offset });
}
