// Seed blacklist: token mint addresses to always ignore.
// These are loaded into the DB on first run.
// You can also manage the blacklist through the Settings page in the UI.
export const INITIAL_BLACKLIST: { mint: string; symbol: string }[] = [
  // Example: well-known spam/dust tokens
  // { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC" },
];
