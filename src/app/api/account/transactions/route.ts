import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import {
  getTransactions,
  getBalance,
  getAvailableBalance,
  type TransactionType,
  type TransactionStatus,
} from '@/lib/ledger';
import { ensureSeeded } from '@/lib/accounts';

export async function GET(req: NextRequest) {
  ensureSeeded();
  try {
    const { account } = requireAuth(req);
    const { searchParams } = new URL(req.url);

    const limit = Number(searchParams.get('limit') ?? 50);
    const type = searchParams.get('type') as TransactionType | null;
    const status = searchParams.get('status') as TransactionStatus | null;

    const transactions = getTransactions(account.id, {
      limit,
      ...(type && { type }),
      ...(status && { status }),
    });

    return NextResponse.json({
      transactions,
      balance: round(getBalance(account.id)),
      availableBalance: round(getAvailableBalance(account.id)),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function round(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
