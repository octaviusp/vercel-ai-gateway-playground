import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { ensureSeeded } from '@/lib/accounts';

export async function GET(req: NextRequest) {
  ensureSeeded();
  try {
    const { account } = requireAuth(req);
    return NextResponse.json({ account });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
