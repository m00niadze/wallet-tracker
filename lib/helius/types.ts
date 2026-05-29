export type TransactionType =
  | "SWAP"
  | "TRANSFER"
  | "BURN"
  | "MINT"
  | "UNKNOWN"
  | string;

export type TransactionSource =
  | "JUPITER"
  | "RAYDIUM"
  | "ORCA"
  | "PUMP_FUN"
  | "MOONSHOT"
  | "SYSTEM_PROGRAM"
  | string;

export interface NativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number; // lamports
}

export interface TokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number; // decimal-adjusted float
  mint: string;
}

export interface SwapTokenSide {
  userAccount: string;
  tokenAccount: string;
  mint: string;
  rawTokenAmount: {
    tokenAmount: string; // integer string, NOT decimal-adjusted
    decimals: number;
  };
}

export interface InnerSwap {
  tokenInputs: SwapTokenSide[];
  tokenOutputs: SwapTokenSide[];
  programInfo: {
    source: string;
    account: string;
    programName: string;
    instructionName: string;
  };
}

export interface SwapEvent {
  nativeInput: { account: string; amount: string } | null; // amount in lamports string
  nativeOutput: { account: string; amount: string } | null;
  tokenInputs: SwapTokenSide[];
  tokenOutputs: SwapTokenSide[];
  tokenFees: unknown[];
  nativeFees: unknown[];
  innerSwaps: InnerSwap[];
}

export interface AccountData {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges: {
    userAccount: string;
    tokenAccount: string;
    mint: string;
    rawTokenAmount: { tokenAmount: string; decimals: number };
  }[];
}

export interface EnhancedTransaction {
  description: string;
  type: TransactionType;
  source: TransactionSource;
  fee: number; // lamports
  feePayer: string;
  signature: string;
  slot: number;
  timestamp: number; // unix epoch
  nativeTransfers: NativeTransfer[];
  tokenTransfers: TokenTransfer[];
  accountData: AccountData[];
  transactionError: unknown | null;
  events: {
    swap?: SwapEvent;
  };
}

// ─── Parsed output from parser ─────────────────────────────────────────────

export type ActionType = "BUY" | "SELL" | "SEND" | "RECEIVE";
export type TxKind = "SWAP" | "TRANSFER";

export interface ParsedTransaction {
  signature: string;
  walletAddress: string;
  walletName: string;
  action: ActionType;
  txType: TxKind;
  tokenMint: string;
  tokenAmount: number;
  spentSol: number | null;
  spentStable: number | null;
  spentStableSymbol: string | null;
  spentTokenMint: string | null;   // token-for-token swap: the token that was paid with
  spentTokenAmount: number | null; // amount of that token spent
  dexSource: string;
  blockTime: number;
}

// ─── Final record stored in DB and sent to Telegram ─────────────────────────

export interface StoredTransaction {
  id?: number;
  signature: string;
  walletAddress: string;
  walletName: string;
  action: ActionType;
  txType: TxKind;
  tokenMint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  tokenAmount: number;
  spentSol: number | null;
  spentStable: number | null;
  spentStableSymbol: string | null;
  spentUsdValue: number | null;
  priceUsd: number | null;
  marketCap: number | null;
  dexSource: string;
  dexscreenerUrl: string | null;
  axiomUrl: string | null;
  blockTime: number;
  createdAt?: number;
  isBlacklisted: number;
}
