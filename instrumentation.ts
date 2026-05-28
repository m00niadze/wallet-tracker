export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getWallets } = await import("@/lib/db");
  const { backfillWallet } = await import("@/lib/helius/history");

  const wallets = getWallets();
  if (wallets.length === 0) return;

  console.log(`[startup] backfilling ${wallets.length} wallet(s)…`);

  // Run concurrently but don't block server startup
  Promise.allSettled(wallets.map((w) => backfillWallet(w.address))).then(
    (results) => {
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) console.warn(`[startup] ${failed} backfill(s) failed`);
      else console.log("[startup] all backfills complete");
    }
  );
}
