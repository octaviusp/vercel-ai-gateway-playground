import { randomUUID } from 'crypto';

// ─── Types ───

export type TransactionType = 'topup' | 'hold' | 'charge' | 'release' | 'refund';
export type TransactionStatus = 'pending' | 'settled' | 'voided';

export type TransactionMetadata = {
  model?: string;
  operation?: string;
  description?: string;
  generationId?: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  type: TransactionType;
  /** Positive for credits (topup, release, refund), negative for debits (hold, charge) */
  amount: number;
  currency: 'usd';
  status: TransactionStatus;
  /** Links hold ↔ charge, hold ↔ release */
  relatedTxId: string | null;
  /** For deduplication */
  idempotencyKey: string | null;
  metadata: TransactionMetadata;
  createdAt: string;
  updatedAt: string;
};

// ─── Logger ───

const TAG = '\x1b[36m[LEDGER]\x1b[0m';
const WARN = '\x1b[33m[LEDGER]\x1b[0m';
const ERR = '\x1b[31m[LEDGER]\x1b[0m';
const OK = '\x1b[32m[LEDGER]\x1b[0m';

function fmtAmount(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}$${n.toFixed(6)}`;
}

function fmtTx(tx: Transaction): string {
  const model = tx.metadata.model ? ` model=${tx.metadata.model}` : '';
  const gen = tx.metadata.generationId ? ` gen=${tx.metadata.generationId.slice(0, 8)}` : '';
  const related = tx.relatedTxId ? ` related=${tx.relatedTxId.slice(0, 8)}` : '';
  return `tx=${tx.id.slice(0, 8)} type=${tx.type} ${fmtAmount(tx.amount)} status=${tx.status}${model}${gen}${related}`;
}

// ─── Store ───

const ledger = new Map<string, Transaction[]>();
const txById = new Map<string, Transaction>();
const idempotencyIndex = new Map<string, Transaction>();

function getOrCreateLedger(accountId: string): Transaction[] {
  let txs = ledger.get(accountId);
  if (!txs) {
    txs = [];
    ledger.set(accountId, txs);
  }
  return txs;
}

// ─── Core Operations ───

export function createTransaction(params: {
  accountId: string;
  type: TransactionType;
  amount: number;
  relatedTxId?: string;
  idempotencyKey?: string;
  metadata?: TransactionMetadata;
}): Transaction {
  console.log(`${TAG} createTransaction(type=${params.type}, amount=${fmtAmount(params.amount)}, account=${params.accountId.slice(0, 8)})`);

  // NaN / Infinity guard — a single NaN permanently corrupts account balance
  if (!Number.isFinite(params.amount)) {
    console.error(`${ERR}   ↳ REJECTED: amount is not finite (${params.amount})`);
    throw new Error(`Transaction amount must be finite (got ${params.amount})`);
  }

  // Idempotency check
  if (params.idempotencyKey) {
    const idemKey = `${params.accountId}:${params.idempotencyKey}`;
    const existing = idempotencyIndex.get(idemKey);
    if (existing) {
      console.log(`${WARN}   ↳ IDEMPOTENCY HIT — returning existing ${fmtTx(existing)}`);
      return existing;
    }
  }

  // Validate amount sign — reject zero for debits
  if (params.type === 'topup' || params.type === 'release' || params.type === 'refund') {
    if (params.amount < 0) {
      console.error(`${ERR}   ↳ REJECTED: ${params.type} amount must be positive, got ${params.amount}`);
      throw new Error(`${params.type} amount must be positive`);
    }
  }
  if (params.type === 'hold' || params.type === 'charge') {
    if (params.amount >= 0) {
      console.error(`${ERR}   ↳ REJECTED: ${params.type} amount must be negative, got ${params.amount}`);
      throw new Error(`${params.type} amount must be negative (got ${params.amount})`);
    }
  }

  const status: TransactionStatus = params.type === 'hold' ? 'pending' : 'settled';

  const now = new Date().toISOString();
  const tx: Transaction = {
    id: randomUUID(),
    accountId: params.accountId,
    type: params.type,
    amount: params.amount,
    currency: 'usd',
    status,
    relatedTxId: params.relatedTxId ?? null,
    idempotencyKey: params.idempotencyKey ?? null,
    metadata: params.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };

  getOrCreateLedger(params.accountId).push(tx);
  txById.set(tx.id, tx);

  if (params.idempotencyKey) {
    idempotencyIndex.set(`${params.accountId}:${params.idempotencyKey}`, tx);
  }

  const bal = getBalance(params.accountId);
  const avail = getAvailableBalance(params.accountId);
  console.log(`${OK}   ↳ CREATED ${fmtTx(tx)}`);
  console.log(`${TAG}   ↳ BALANCE after: settled=${fmtAmount(bal)} available=${fmtAmount(avail)}`);

  return tx;
}

/**
 * Transition a pending hold to voided.
 * IDEMPOTENT: if already voided, returns the transaction without error.
 */
export function voidTransaction(txId: string): Transaction {
  console.log(`${TAG} voidTransaction(tx=${txId.slice(0, 8)})`);

  const tx = txById.get(txId);
  if (!tx) {
    console.error(`${ERR}   ↳ NOT FOUND: tx=${txId}`);
    throw new Error(`Transaction ${txId} not found`);
  }
  if (tx.type !== 'hold') {
    console.error(`${ERR}   ↳ REJECTED: cannot void type=${tx.type} (only hold)`);
    throw new Error(`Only hold transactions can be voided (got ${tx.type})`);
  }

  // IDEMPOTENT: already voided → return as-is
  if (tx.status === 'voided') {
    console.log(`${WARN}   ↳ ALREADY VOIDED tx=${txId.slice(0, 8)} — idempotent return`);
    return tx;
  }

  if (tx.status !== 'pending') {
    console.error(`${ERR}   ↳ REJECTED: tx is ${tx.status}, expected pending`);
    throw new Error(`Transaction ${txId} is ${tx.status}, expected pending`);
  }

  const prevStatus = tx.status;
  tx.status = 'voided';
  tx.updatedAt = new Date().toISOString();

  const bal = getBalance(tx.accountId);
  const avail = getAvailableBalance(tx.accountId);
  console.log(`${OK}   ↳ VOIDED ${fmtTx(tx)} (was: ${prevStatus})`);
  console.log(`${TAG}   ↳ BALANCE after: settled=${fmtAmount(bal)} available=${fmtAmount(avail)}`);

  return tx;
}

// ─── Balance Computation ───

export function getBalance(accountId: string): number {
  const txs = ledger.get(accountId) ?? [];
  return txs
    .filter((tx) => tx.status === 'settled')
    .reduce((sum, tx) => sum + tx.amount, 0);
}

export function getAvailableBalance(accountId: string): number {
  const txs = ledger.get(accountId) ?? [];
  return txs
    .filter((tx) => tx.status === 'settled' || tx.status === 'pending')
    .reduce((sum, tx) => sum + tx.amount, 0);
}

export function getPendingHoldsTotal(accountId: string): number {
  const txs = ledger.get(accountId) ?? [];
  return txs
    .filter((tx) => tx.status === 'pending' && tx.type === 'hold')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}

// ─── Query ───

export function getTransactionById(id: string): Transaction | null {
  return txById.get(id) ?? null;
}

// ─── Hold Expiration ───

const HOLD_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Void any holds older than TTL. Prevents permanently locked funds
 * from crashed/timed-out generations.
 */
export function cleanupExpiredHolds(): number {
  const cutoff = new Date(Date.now() - HOLD_TTL_MS).toISOString();
  let cleaned = 0;
  for (const [, txs] of ledger) {
    for (const tx of txs) {
      if (tx.type === 'hold' && tx.status === 'pending' && tx.createdAt < cutoff) {
        console.log(`${WARN} ⏰ EXPIRING stale hold tx=${tx.id.slice(0, 8)} age=${Math.round((Date.now() - new Date(tx.createdAt).getTime()) / 1000)}s`);
        tx.status = 'voided';
        tx.updatedAt = new Date().toISOString();
        cleaned++;
      }
    }
  }
  if (cleaned > 0) {
    console.log(`${WARN} ⏰ Cleaned ${cleaned} expired hold(s)`);
  }
  return cleaned;
}

// Run cleanup every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredHolds, 60_000);
}

export function getTransactions(
  accountId: string,
  opts?: { limit?: number; type?: TransactionType; status?: TransactionStatus }
): Transaction[] {
  let txs = ledger.get(accountId) ?? [];

  if (opts?.type) txs = txs.filter((tx) => tx.type === opts.type);
  if (opts?.status) txs = txs.filter((tx) => tx.status === opts.status);

  const sorted = [...txs].reverse();
  return sorted.slice(0, opts?.limit ?? 50);
}
