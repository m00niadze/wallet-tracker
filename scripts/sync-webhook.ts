import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { syncWebhook } from "../lib/helius/webhook-manager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env.local") });

async function main() {
  await syncWebhook();
  console.log("Webhook synced successfully!");
}

main().catch((err) => {
  console.error("Failed:", err?.response?.data ?? err?.message ?? err);
  process.exit(1);
});
