import { Telegraf } from "telegraf";
import type { StoredTransaction } from "./helius/types";

let _bot: Telegraf | null = null;

function getBot(): Telegraf {
  if (!_bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
    _bot = new Telegraf(token);
  }
  return _bot;
}

function formatMarketCap(mc: number | null): string {
  if (mc == null) return "N/A";
  if (mc >= 1_000_000_000) return `$${(mc / 1_000_000_000).toFixed(2)}B`;
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
  return `$${mc.toFixed(0)}`;
}

function formatAmount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(n < 1 ? 6 : 2);
}

function actionEmoji(action: StoredTransaction["action"]): string {
  switch (action) {
    case "BUY":     return "🟢";
    case "SELL":    return "🔴";
    case "SEND":    return "📤";
    case "RECEIVE": return "📥";
  }
}

function buildSpentLine(tx: StoredTransaction): string {
  const usdStr = tx.spentUsdValue != null ? ` (~$${tx.spentUsdValue.toFixed(2)})` : "";
  const label = tx.action === "SELL" ? "Received" : "Spent";
  if (tx.spentSol != null) return `${label}: ${tx.spentSol.toFixed(4)} SOL${usdStr}`;
  if (tx.spentStable != null) return `${label}: ${tx.spentStable.toFixed(2)} ${tx.spentStableSymbol ?? "stable"}`;
  return "";
}

function formatMessage(tx: StoredTransaction): string {
  const emoji = actionEmoji(tx.action);
  const symbol = tx.tokenSymbol ? `$${tx.tokenSymbol}` : "";
  const tokenDisplay = tx.tokenName
    ? `${tx.tokenName}${symbol ? ` (${symbol})` : ""}`
    : tx.tokenMint.slice(0, 8) + "...";

  const spentLine = buildSpentLine(tx);
  const priceStr = tx.priceUsd != null
    ? `$${tx.priceUsd < 0.000001 ? tx.priceUsd.toExponential(3) : tx.priceUsd.toPrecision(4)}`
    : "N/A";
  const mcStr = formatMarketCap(tx.marketCap);
  const shortCa = `${tx.tokenMint.slice(0, 4)}...${tx.tokenMint.slice(-4)}`;

  const lines: string[] = [
    `${emoji} <b>${tx.action}</b> | ${tx.walletName}`,
    `Token: ${tokenDisplay}`,
  ];

  if (spentLine) lines.push(spentLine);

  const actionLabel = tx.action === "BUY" ? "Received" : tx.action === "SELL" ? "Sold" : "Amount";
  lines.push(`${actionLabel}: ${formatAmount(tx.tokenAmount)} ${tx.tokenSymbol ?? ""}`);

  lines.push(`Price: ${priceStr} | MC: ${mcStr}`);
  lines.push(`CA: <code>${tx.tokenMint}</code>`);

  const links: string[] = [];
  if (tx.dexscreenerUrl) links.push(`<a href="${tx.dexscreenerUrl}">📊 DexScreener</a>`);
  if (tx.axiomUrl) links.push(`<a href="${tx.axiomUrl}">🔮 Axiom</a>`);
  if (links.length) lines.push(links.join(" | "));

  return lines.join("\n");
}

export async function sendAlert(tx: StoredTransaction): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  try {
    const bot = getBot();
    await bot.telegram.sendMessage(chatId, formatMessage(tx), {
      parse_mode: "HTML",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      link_preview_options: { is_disabled: true } as any,
    });
  } catch (err) {
    console.error("[telegram] sendAlert failed:", err);
  }
}
