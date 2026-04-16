import { NextRequest, NextResponse } from 'next/server';
import { getAccountByEmail, ensureSeeded } from '@/lib/accounts';
import { createSession, sessionCookieHeader } from '@/lib/auth';

export async function POST(req: NextRequest) {
  ensureSeeded();
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const account = getAccountByEmail(email);
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const session = createSession(account.id);

  const res = NextResponse.json({ account, token: session.token });
  res.headers.set('Set-Cookie', sessionCookieHeader(session.token));
  return res;
}
