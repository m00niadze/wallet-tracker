import axios from "axios";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedPrice: number | null = null;
let lastFetch = 0;

export async function getSolPrice(): Promise<number> {
  const now = Date.now();
  if (cachedPrice !== null && now - lastFetch < CACHE_TTL_MS) {
    return cachedPrice;
  }

  try {
    const res = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${SOL_MINT}`,
      { timeout: 5000 }
    );
    const pairs: { priceUsd: string; chainId: string; liquidity?: { usd: number } }[] =
      res.data?.pairs ?? [];
    const solanaPairs = pairs
      .filter((p) => p.chainId === "solana")
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    if (solanaPairs.length > 0) {
      cachedPrice = parseFloat(solanaPairs[0].priceUsd);
      lastFetch = now;
      return cachedPrice;
    }
  } catch {
    // fall through to cached or default
  }

  return cachedPrice ?? 150; // last-known or rough fallback
}
