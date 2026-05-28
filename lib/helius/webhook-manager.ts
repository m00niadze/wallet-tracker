import axios from "axios";
import { getWallets, getSetting, setSetting } from "@/lib/db";

const BASE = "https://api.helius.xyz/v0/webhooks";

function apiUrl(path = "") {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error("HELIUS_API_KEY is not set");
  return `${BASE}${path}?api-key=${key}`;
}

function webhookBody(addresses: string[]) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return {
    webhookURL: `${appUrl}/api/webhook`,
    transactionTypes: ["SWAP", "TRANSFER"],
    accountAddresses: addresses,
    webhookType: "enhanced",
    ...(process.env.HELIUS_WEBHOOK_SECRET
      ? { authHeader: process.env.HELIUS_WEBHOOK_SECRET }
      : {}),
  };
}

async function getWebhookId(): Promise<string | null> {
  return getSetting("helius_webhook_id");
}

async function createWebhook(addresses: string[]): Promise<string> {
  const res = await axios.post(apiUrl(), webhookBody(addresses));
  const id: string = res.data.webhookID;
  setSetting("helius_webhook_id", id);
  return id;
}

async function updateWebhook(id: string, addresses: string[]): Promise<void> {
  await axios.put(apiUrl(`/${id}`), webhookBody(addresses));
}

/**
 * Syncs the Helius webhook address list with whatever is currently in the DB.
 * Creates the webhook on first call; updates it on subsequent calls.
 */
export async function syncWebhook(): Promise<void> {
  const wallets = getWallets();
  const addresses = wallets.map((w) => w.address);

  const existingId = await getWebhookId();

  if (!existingId) {
    if (addresses.length === 0) return; // nothing to register yet
    await createWebhook(addresses);
  } else {
    await updateWebhook(existingId, addresses);
  }
}
