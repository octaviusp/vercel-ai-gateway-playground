import { useCallback, useEffect, useState } from 'react';
import type { Account } from '@/lib/accounts';

export function useAuth() {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.account) setUser(data.account);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Login failed');
    }
    const data = await res.json();
    setUser(data.account);
  }, []);

  const register = useCallback(async (email: string, name: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Registration failed');
    }
    const data = await res.json();
    setUser(data.account);
  }, []);

  const logout = useCallback(() => {
    // Clear cookie by setting expired date
    document.cookie = 'artyx_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setUser(null);
  }, []);

  return { user, loading, login, register, logout };
}
