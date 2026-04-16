import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { getAccountById, type Account } from './accounts';

// ─── Types ───

export type Session = {
  token: string;
  accountId: string;
  createdAt: string;
};

// ─── Logger ───

const TAG = '\x1b[33m[AUTH]\x1b[0m'; // yellow
const OK = '\x1b[32m[AUTH]\x1b[0m';
const ERR = '\x1b[31m[AUTH]\x1b[0m';

// ─── Store ───

const sessions = new Map<string, Session>();

const COOKIE_NAME = 'artyx_session';

// ─── Service ───

export function createSession(accountId: string): Session {
  const token = randomBytes(32).toString('hex');
  const session: Session = {
    token,
    accountId,
    createdAt: new Date().toISOString(),
  };
  sessions.set(token, session);
  console.log(`${OK} ✓ SESSION CREATED for account=${accountId.slice(0, 8)} token=${token.slice(0, 12)}...`);
  return session;
}

export function getSession(token: string): Session | null {
  return sessions.get(token) ?? null;
}

export function destroySession(token: string): void {
  console.log(`${TAG} SESSION DESTROYED token=${token.slice(0, 12)}...`);
  sessions.delete(token);
}

export function getSessionFromRequest(req: NextRequest): Session | null {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (cookie?.value) {
    const session = sessions.get(cookie.value);
    if (session) {
      console.log(`${TAG} Session from cookie → account=${session.accountId.slice(0, 8)}`);
      return session;
    }
  }

  const header = req.headers.get('x-session-token');
  if (header) {
    const session = sessions.get(header);
    if (session) {
      console.log(`${TAG} Session from header → account=${session.accountId.slice(0, 8)}`);
      return session;
    }
  }

  return null;
}

export function requireAuth(req: NextRequest): { session: Session; account: Account } {
  const session = getSessionFromRequest(req);
  if (!session) {
    console.log(`${ERR} requireAuth FAILED — no valid session`);
    throw new AuthError('Not authenticated', 401);
  }

  const account = getAccountById(session.accountId);
  if (!account) {
    console.log(`${ERR} requireAuth FAILED — account not found for session`);
    throw new AuthError('Account not found', 404);
  }

  return { session, account };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${60 * 60 * 24 * 7}`;
}
