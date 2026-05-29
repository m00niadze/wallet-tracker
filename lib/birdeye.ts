import axios from "axios";

// Per-mint-per-minute cache — historical prices never change once fetched
const cache = new Map<string, number>();

export async function getHistoricalPrice(mint: string, timestamp: number): Promise<number | null> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return null;

  const minuteKey = `${mint}:${Math.floor(timestamp / 60)}`;
  if (cache.has(minuteKey)) return cache.get(minuteKey)!;

  try {
    const res = await axios.get("https://public-api.birdeye.so/defi/history_price", {
      params: {
        address: mint,
        address_type: "token",
        type: "1m",
        time_from: timestamp - 120,
        time_to: timestamp + 120,
      },
      headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
      timeout: 6000,
    });

    const items: { unixTime: number; value: number }[] = res.data?.data?.items ?? [];
    if (items.length === 0) return null;

    // Closest candle to the transaction timestamp
    const closest = items.reduce((best, item) =>
      Math.abs(item.unixTime - timestamp) < Math.abs(best.unixTime - timestamp) ? item : best
    );

    cache.set(minuteKey, closest.value);
    return closest.value;
  } catch {
    return null;
  }
}
