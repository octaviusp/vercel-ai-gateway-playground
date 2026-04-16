import {
  createTransaction,
  voidTransaction,
  getAvailableBalance,
  getBalance,
  getTransactionById,
  type Transaction,
} from './ledger';
import { estimateHoldAmount } from './cost-estimator';

// ─── Logger ───

const TAG = '\x1b[35m[BILLING-FLOW]\x1b[0m';
const OK = '\x1b[32m[BILLING-FLOW]\x1b[0m';
const ERR = '\x1b[31m[BILLING-FLOW]\x1b[0m';
const WARN = '\x1b[33m[BILLING-FLOW]\x1b[0m';

// ─── Types ───

export type HoldResult =
  | { ok: true; holdTx: Transaction; estimatedCost: number }
  | { ok: false; error: 'insufficient_funds'; available: number; required: number };

// ─── Operations ───

export function createGenerationHold(params: {
  accountId: string;
  model: string;
  modelType: 'language' | 'image';
  operation: string;
  generationId: string;
  modelPricing?: { input?: string; output?: string; image?: string };
}): HoldResult {
  const estimated = estimateHoldAmount({
    model: params.model,
    modelType: params.modelType,
    pricing: params.modelPricing,
  });

  const available = getAvailableBalance(params.accountId);
  const balance = getBalance(params.accountId);

  console.log(`${TAG} ━━━ CREATE HOLD ━━━`);
  console.log(`${TAG}   account=${params.accountId.slice(0, 8)} model=${params.model}`);
  console.log(`${TAG}   estimated_hold=$${estimated.toFixed(6)} balance=$${balance.toFixed(6)} available=$${available.toFixed(6)}`);
  console.log(`${TAG}   generationId=${params.generationId.slice(0, 8)}`);

  if (available < estimated) {
    console.log(`${ERR}   ✗ INSUFFICIENT FUNDS: need $${estimated.toFixed(6)}, have $${available.toFixed(6)}`);
    return {
      ok: false,
      error: 'insufficient_funds',
      available: Math.round(available * 1_000_000) / 1_000_000,
      required: estimated,
    };
  }

  const holdTx = createTransaction({
    accountId: params.accountId,
    type: 'hold',
    amount: -estimated,
    idempotencyKey: `hold:${params.generationId}`,
    metadata: {
      model: params.model,
      operation: params.operation,
      generationId: params.generationId,
      description: `Hold for ${params.model} generation`,
    },
  });

  console.log(`${OK}   ✓ HOLD CREATED tx=${holdTx.id.slice(0, 8)} amount=-$${estimated.toFixed(6)}`);
  return { ok: true, holdTx, estimatedCost: estimated };
}

/**
 * Settle a generation: void the hold and create a charge with the real cost.
 *
 * SAFETY: If actualCost is null/undefined/NaN → falls back to hold estimate.
 * SAFETY: If actualCost is 0 → free generation (void hold, no charge).
 * SAFETY: If actualCost > hold → charges actual (warns, overdraft possible).
 * ATOMICITY: Pre-validates charge before voiding. If charge fails post-void, logs critical.
 */
export function settleGeneration(params: {
  holdTxId: string;
  actualCost: number | undefined;
  generationId: string;
  metadata?: { model?: string; operation?: string };
}): Transaction | null {
  const holdTx = getTransactionById(params.holdTxId);
  if (!holdTx) {
    console.error(`${ERR} ━━━ SETTLE FAILED: hold tx ${params.holdTxId} not found ━━━`);
    return null;
  }

  const holdAmount = Math.abs(holdTx.amount);

  // Determine cost: actual (even $0 for free models) vs fallback to estimate
  let cost: number;
  let costSource: string;
  if (params.actualCost != null && Number.isFinite(params.actualCost) && params.actualCost >= 0) {
    cost = params.actualCost; // Real cost — even $0.00 for free models
    costSource = cost === 0 ? 'actual (free)' : 'actual';
  } else {
    cost = holdAmount; // Gateway returned nothing usable — charge the estimate
    costSource = 'estimated (gateway cost missing)';
    console.log(`${WARN}   ⚠ Gateway cost unusable (${params.actualCost}) — falling back to hold estimate $${holdAmount.toFixed(6)}`);
  }

  // Warn on overage but charge the real amount
  if (cost > holdAmount) {
    console.log(`${WARN}   ⚠ OVERAGE: actual $${cost.toFixed(6)} > hold $${holdAmount.toFixed(6)} — charging actual (overdraft possible)`);
  }

  console.log(`${TAG} ━━━ SETTLE GENERATION ━━━`);
  console.log(`${TAG}   holdTx=${params.holdTxId.slice(0, 8)} hold=$${holdAmount.toFixed(6)} charge=$${cost.toFixed(6)} [${costSource}] gen=${params.generationId.slice(0, 8)}`);

  // PRE-VALIDATE charge amount before voiding (atomicity guard)
  if (!Number.isFinite(cost) || cost < 0) {
    console.error(`${ERR}   ✗ Invalid charge amount: ${cost} — releasing hold instead`);
    voidTransaction(params.holdTxId);
    return null;
  }

  // Skip zero-charge — just void the hold (free generation)
  if (cost === 0) {
    console.log(`${TAG}   Step 1: Voiding hold (free generation, no charge)...`);
    voidTransaction(params.holdTxId);
    console.log(`${OK}   ✓ SETTLED: hold voided, $0 charge (free)`);
    return null;
  }

  // Step 1: Void the hold
  console.log(`${TAG}   Step 1: Voiding hold...`);
  voidTransaction(params.holdTxId);

  // Step 2: Create the final charge (pre-validated above — should not fail)
  try {
    console.log(`${TAG}   Step 2: Creating charge for -$${cost.toFixed(6)}...`);
    const chargeTx = createTransaction({
      accountId: holdTx.accountId,
      type: 'charge',
      amount: -cost,
      relatedTxId: params.holdTxId,
      idempotencyKey: `charge:${params.generationId}`,
      metadata: {
        ...params.metadata,
        generationId: params.generationId,
        description: `Charge for generation (${costSource})`,
      },
    });

    console.log(`${OK}   ✓ SETTLED: hold voided + charge tx=${chargeTx.id.slice(0, 8)} amount=-$${cost.toFixed(6)}`);
    return chargeTx;
  } catch (err) {
    console.error(`${ERR}   ✗✗✗ CRITICAL: Hold voided but charge creation FAILED ✗✗✗`);
    console.error(`${ERR}   holdTx=${params.holdTxId} gen=${params.generationId} cost=${cost} err=${err}`);
    console.error(`${ERR}   ACTION REQUIRED: Manual reconciliation — user got free generation worth $${cost.toFixed(6)}`);
    return null;
  }
}

/**
 * Release a hold without charging.
 * Called when generation fails or is cancelled.
 */
export function releaseHold(params: {
  holdTxId: string;
  reason: string;
}): void {
  console.log(`${TAG} ━━━ RELEASE HOLD ━━━`);
  console.log(`${TAG}   holdTx=${params.holdTxId.slice(0, 8)} reason="${params.reason.slice(0, 100)}"`);

  try {
    voidTransaction(params.holdTxId);
    console.log(`${OK}   ✓ RELEASED: hold voided, funds returned`);
  } catch (err) {
    // Already voided (idempotent) or not found — log but don't throw
    console.log(`${WARN}   ⚠ Release failed (may already be settled): ${err instanceof Error ? err.message : err}`);
  }
}
