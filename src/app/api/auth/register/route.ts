import { NextRequest, NextResponse } from 'next/server';
import { createAccount, ensureSeeded } from '@/lib/accounts';
import { createSession, sessionCookieHeader } from '@/lib/auth';

export async function POST(req: NextRequest) {
  ensureSeeded();
  const { email, name } = await req.json();

  if (!email || !name) {
    return NextResponse.json({ error: 'Email and name required' }, { status: 400 });
  }

  try {
    const account = createAccount(email, name);
    const session = createSession(account.id);

    const res = NextResponse.json({ account, token: session.token });
    res.headers.set('Set-Cookie', sessionCookieHeader(session.token));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
