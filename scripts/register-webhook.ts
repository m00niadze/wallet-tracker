/**
 * Run once after deploying to register your wallet addresses with Helius.
 *
 *   npx ts-node --skip-project scripts/register-webhook.ts
 *
 * Set the env vars in .env.local before running:
 *   HELIUS_API_KEY, HELIUS_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL
 */

import axios from "axios";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env.local") });

const { HELIUS_API_KEY, HELIUS_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL } = process.env;

if (!HELIUS_API_KEY) throw new Error("HELIUS_API_KEY not set in .env.local");
if (!NEXT_PUBLIC_APP_URL) throw new Error("NEXT_PUBLIC_APP_URL not set in .env.local");

// Import wallets after env is loaded
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WALLETS } = require("../config/wallets") as { WALLETS: Record<string, string> };

const addresses = Object.values(WALLETS).filter((a) => a !== "PASTE_WALLET_ADDRESS_HERE");

if (addresses.length === 0) {
  console.error("No wallet addresses configured. Edit config/wallets.ts first.");
  process.exit(1);
}

async function main() {
  const webhookURL = `${NEXT_PUBLIC_APP_URL}/api/webhook`;

  console.log(`Registering ${addresses.length} wallet(s) with Helius...`);
  console.log(`Webhook URL: ${webhookURL}`);
  console.log(`Wallets: ${addresses.join(", ")}`);

  const body = {
    webhookURL,
    transactionTypes: ["SWAP", "TRANSFER"],
    accountAddresses: addresses,
    webhookType: "enhanced",
    ...(HELIUS_WEBHOOK_SECRET ? { authHeader: HELIUS_WEBHOOK_SECRET } : {}),
  };

  const res = await axios.post(
    `https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`,
    body,
    { headers: { "Content-Type": "application/json" } }
  );

  console.log("\nWebhook registered successfully!");
  console.log("Webhook ID:", res.data.webhookID);
  console.log("\nSave this ID — you'll need it to update or delete the webhook.");
  console.log("Manage webhooks at: https://dev.helius.xyz/dashboard");
}

main().catch((err) => {
  const msg = err?.response?.data ?? err?.message ?? err;
  console.error("Registration failed:", JSON.stringify(msg, null, 2));
  process.exit(1);
});
