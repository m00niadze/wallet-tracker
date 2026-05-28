// Add wallets you want to track here.
// Key = display name shown in alerts, value = Solana public key.
export const WALLETS: Record<string, string> = {
  "Wallet 1": "PASTE_WALLET_ADDRESS_HERE",
  // "Whale Alpha": "7xKp...",
  // "Smart Money": "9mNq...",
};

export const WALLET_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(WALLETS).map(([name, address]) => [address, name])
);
