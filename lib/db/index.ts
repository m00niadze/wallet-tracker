import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { StoredTransaction } from "@/lib/helius/types";
import { INITIAL_BLACKLIST } from "@/config/blacklist";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "tracker.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  seedBlacklist(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      signature        TEXT    NOT NULL UNIQUE,
      wallet_address   TEXT    NOT NULL,
      wallet_name      TEXT    NOT NULL,
      action           TEXT    NOT NULL CHECK(action IN ('BUY','SELL','SEND','RECEIVE')),
      tx_type          TEXT    NOT NULL CHECK(tx_type IN ('SWAP','TRANSFER')),
      token_mint       TEXT    NOT NULL,
      token_name       TEXT,
      token_symbol     TEXT,
      token_amount          REAL    NOT NULL,
      spent_sol             REAL,
      spent_stable          REAL,
      spent_stable_symbol   TEXT,
      spent_usd_value       REAL,
      price_usd        REAL,
      market_cap       REAL,
      dex_source       TEXT,
      dexscreener_url  TEXT,
      axiom_url        TEXT,
      block_time       INTEGER NOT NULL,
      created_at       INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      is_blacklisted   INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_time ON transactions(block_time DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_mint ON transactions(token_mint);
    CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_address);

    CREATE TABLE IF NOT EXISTS token_blacklist (
      mint      TEXT PRIMARY KEY,
      symbol    TEXT,
      added_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS webhook_events_raw (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      signature   TEXT    NOT NULL,
      payload     TEXT    NOT NULL,
      received_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      processed   INTEGER NOT NULL DEFAULT 0,
      error       TEXT
    );

    CREATE TABLE IF NOT EXISTS wallets (
      address    TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      added_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function seedBlacklist(db: Database.Database) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO token_blacklist (mint, symbol) VALUES (?, ?)"
  );
  for (const entry of INITIAL_BLACKLIST) {
    insert.run(entry.mint, entry.symbol);
  }
}

// ─── Transactions ────────────────────────────────────────────────────────────

export function insertTransaction(tx: StoredTransaction): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO transactions
      (signature, wallet_address, wallet_name, action, tx_type,
       token_mint, token_name, token_symbol, token_amount,
       spent_sol, spent_stable, spent_stable_symbol, spent_usd_value,
       price_usd, market_cap, dex_source,
       dexscreener_url, axiom_url, block_time, is_blacklisted)
    VALUES
      (@signature, @walletAddress, @walletName, @action, @txType,
       @tokenMint, @tokenName, @tokenSymbol, @tokenAmount,
       @spentSol, @spentStable, @spentStableSymbol, @spentUsdValue,
       @priceUsd, @marketCap, @dexSource,
       @dexscreenerUrl, @axiomUrl, @blockTime, @isBlacklisted)
  `).run({
    signature: tx.signature,
    walletAddress: tx.walletAddress,
    walletName: tx.walletName,
    action: tx.action,
    txType: tx.txType,
    tokenMint: tx.tokenMint,
    tokenName: tx.tokenName ?? null,
    tokenSymbol: tx.tokenSymbol ?? null,
    tokenAmount: tx.tokenAmount,
    spentSol: tx.spentSol ?? null,
    spentStable: tx.spentStable ?? null,
    spentStableSymbol: tx.spentStableSymbol ?? null,
    spentUsdValue: tx.spentUsdValue ?? null,
    priceUsd: tx.priceUsd ?? null,
    marketCap: tx.marketCap ?? null,
    dexSource: tx.dexSource,
    dexscreenerUrl: tx.dexscreenerUrl ?? null,
    axiomUrl: tx.axiomUrl ?? null,
    blockTime: tx.blockTime,
    isBlacklisted: tx.isBlacklisted,
  });
}

export function getRecentTransactions(
  limit = 50,
  offset = 0,
  showBlacklisted = false
): StoredTransaction[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM transactions
    WHERE is_blacklisted = ${showBlacklisted ? 1 : 0} OR is_blacklisted = 0
    ORDER BY block_time DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Record<string, unknown>[];
  return rows.map(rowToStored);
}

function rowToStored(row: Record<string, unknown>): StoredTransaction {
  return {
    id: row.id as number,
    signature: row.signature as string,
    walletAddress: row.wallet_address as string,
    walletName: row.wallet_name as string,
    action: row.action as StoredTransaction["action"],
    txType: row.tx_type as StoredTransaction["txType"],
    tokenMint: row.token_mint as string,
    tokenName: row.token_name as string | null,
    tokenSymbol: row.token_symbol as string | null,
    tokenAmount: row.token_amount as number,
    spentSol: row.spent_sol as number | null,
    spentStable: row.spent_stable as number | null,
    spentStableSymbol: row.spent_stable_symbol as string | null,
    spentUsdValue: row.spent_usd_value as number | null,
    priceUsd: row.price_usd as number | null,
    marketCap: row.market_cap as number | null,
    dexSource: row.dex_source as string,
    dexscreenerUrl: row.dexscreener_url as string | null,
    axiomUrl: row.axiom_url as string | null,
    blockTime: row.block_time as number,
    createdAt: row.created_at as number,
    isBlacklisted: row.is_blacklisted as number,
  };
}

// ─── Blacklist ───────────────────────────────────────────────────────────────

export function isBlacklisted(mint: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT 1 FROM token_blacklist WHERE mint = ?").get(mint);
  return !!row;
}

export function getBlacklist(): { mint: string; symbol: string | null; addedAt: number }[] {
  const db = getDb();
  return (db.prepare("SELECT mint, symbol, added_at FROM token_blacklist ORDER BY added_at DESC").all() as Record<string, unknown>[])
    .map((r) => ({ mint: r.mint as string, symbol: r.symbol as string | null, addedAt: r.added_at as number }));
}

export function addToBlacklist(mint: string, symbol?: string): void {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO token_blacklist (mint, symbol) VALUES (?, ?)").run(mint, symbol ?? null);
  db.prepare("UPDATE transactions SET is_blacklisted = 1 WHERE token_mint = ?").run(mint);
}

export function removeFromBlacklist(mint: string): void {
  const db = getDb();
  db.prepare("DELETE FROM token_blacklist WHERE mint = ?").run(mint);
  db.prepare("UPDATE transactions SET is_blacklisted = 0 WHERE token_mint = ?").run(mint);
}

// ─── Raw webhook events ──────────────────────────────────────────────────────

export function insertRawEvent(signature: string, payload: string): number {
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO webhook_events_raw (signature, payload) VALUES (?, ?)"
  ).run(signature, payload);
  return result.lastInsertRowid as number;
}

export function markEventProcessed(id: number, error?: string): void {
  const db = getDb();
  db.prepare("UPDATE webhook_events_raw SET processed = 1, error = ? WHERE id = ?").run(error ?? null, id);
}

// ─── Wallets ─────────────────────────────────────────────────────────────────

export interface WalletRow {
  address: string;
  name: string;
  addedAt: number;
}

export function getWallets(): WalletRow[] {
  const db = getDb();
  return (db.prepare("SELECT address, name, added_at FROM wallets ORDER BY added_at ASC").all() as Record<string, unknown>[])
    .map((r) => ({ address: r.address as string, name: r.name as string, addedAt: r.added_at as number }));
}

export function getWalletNameMap(): Record<string, string> {
  return Object.fromEntries(getWallets().map((w) => [w.address, w.name]));
}

export function addWallet(address: string, name: string): void {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO wallets (address, name) VALUES (?, ?)").run(address, name);
  db.prepare("UPDATE transactions SET wallet_name = ? WHERE wallet_address = ?").run(name, address);
}

export function deleteWallet(address: string): void {
  const db = getDb();
  db.prepare("DELETE FROM wallets WHERE address = ?").run(address);
}

export function walletExists(address: string): boolean {
  const db = getDb();
  return !!db.prepare("SELECT 1 FROM wallets WHERE address = ?").get(address);
}

// ─── Settings (key-value store) ──────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}
