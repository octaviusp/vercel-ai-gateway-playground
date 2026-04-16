import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { getBalance, getAvailableBalance, getPendingHoldsTotal } from '@/lib/ledger';
import { ensureSeeded } from '@/lib/accounts';

export async function GET(req: NextRequest) {
  ensureSeeded();
  try {
    const { account } = requireAuth(req);

    return NextResponse.json({
      account,
      balance: round(getBalance(account.id)),
      availableBalance: round(getAvailableBalance(account.id)),
      pendingHolds: round(getPendingHoldsTotal(account.id)),
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
