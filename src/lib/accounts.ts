import { randomUUID } from 'crypto';

// ─── Types ───

export type Account = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

// ─── Logger ───

const TAG = '\x1b[34m[ACCOUNTS]\x1b[0m'; // blue
const OK = '\x1b[32m[ACCOUNTS]\x1b[0m';

// ─── Store ───

const accountsById = new Map<string, Account>();
const emailToId = new Map<string, string>();

// ─── Service ───

export function createAccount(email: string, name: string): Account {
  const normalized = email.toLowerCase().trim();
  if (emailToId.has(normalized)) {
    console.log(`${TAG} createAccount REJECTED — email already exists: ${normalized}`);
    throw new Error(`Account with email ${normalized} already exists`);
  }
  const account: Account = {
    id: randomUUID(),
    email: normalized,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  accountsById.set(account.id, account);
  emailToId.set(normalized, account.id);
  console.log(`${OK} ✓ CREATED account id=${account.id.slice(0, 8)} name="${account.name}" email=${account.email}`);
  return account;
}

export function getAccountById(id: string): Account | null {
  return accountsById.get(id) ?? null;
}

export function getAccountByEmail(email: string): Account | null {
  const id = emailToId.get(email.toLowerCase().trim());
  if (!id) return null;
  return accountsById.get(id) ?? null;
}

export function listAccounts(): Account[] {
  return Array.from(accountsById.values());
}

// ─── Seed test users ───

export const SEED_USERS = [
  { email: 'admin@demo.com', name: 'Admin' },
  { email: 'user1@demo.com', name: 'User One' },
  { email: 'user2@demo.com', name: 'User Two' },
] as const;

let seeded = false;

export function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  console.log(`${TAG} ━━━ SEEDING TEST USERS ━━━`);
  // Lazy import to break circular dependency (accounts ↔ ledger at module init)
  const { createTransaction } = require('./ledger') as typeof import('./ledger');
  for (const u of SEED_USERS) {
    const existing = getAccountByEmail(u.email);
    if (!existing) {
      const account = createAccount(u.email, u.name);
      createTransaction({
        accountId: account.id,
        type: 'topup',
        amount: 5.0,
        metadata: { description: 'Initial seed credits' },
      });
      console.log(`${OK}   ↳ Seeded ${u.name} with $5.00`);
    }
  }
  console.log(`${TAG} ━━━ SEEDING COMPLETE ━━━`);
}
