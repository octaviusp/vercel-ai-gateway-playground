import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { createTransaction, getBalance, getAvailableBalance } from '@/lib/ledger';
import { ensureSeeded } from '@/lib/accounts';

const TAG = '\x1b[92m[API/TOPUP]\x1b[0m';

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const { account } = requireAuth(req);
    const { amount } = await req.json();
    console.log(`\n${TAG} TOPUP REQUEST — user=${account.name} amount=$${amount}`);

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive finite number' }, { status: 400 });
    }
    if (amount > 100) {
      return NextResponse.json({ error: 'Maximum topup is $100' }, { status: 400 });
    }
    // Cap total balance at $1000 to limit liability
    const currentBalance = getBalance(account.id);
    if (currentBalance + amount > 1000) {
      return NextResponse.json({ error: 'Maximum account balance is $1,000' }, { status: 400 });
    }

    const tx = createTransaction({
      accountId: account.id,
      type: 'topup',
      amount,
      metadata: { description: `Credit topup: $${amount.toFixed(2)}` },
    });

    return NextResponse.json({
      transaction: tx,
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
