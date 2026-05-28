import { EventEmitter } from "events";
import type { StoredTransaction } from "./helius/types";

class TransactionEventBus extends EventEmitter {
  emitTransaction(tx: StoredTransaction) {
    this.emit("transaction", tx);
  }

  onTransaction(listener: (tx: StoredTransaction) => void) {
    this.on("transaction", listener);
  }

  offTransaction(listener: (tx: StoredTransaction) => void) {
    this.off("transaction", listener);
  }
}

// Module-level singleton — shared across all route handlers in the same process.
// This is intentional: the SSE route and webhook route must share the same instance.
declare global {
  // eslint-disable-next-line no-var
  var __txEventBus: TransactionEventBus | undefined;
}

export const eventBus: TransactionEventBus =
  global.__txEventBus ?? (global.__txEventBus = new TransactionEventBus());

eventBus.setMaxListeners(100); // allow many concurrent SSE clients
