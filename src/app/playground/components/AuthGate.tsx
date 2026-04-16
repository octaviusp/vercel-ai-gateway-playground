'use client';

import { useState } from 'react';
import { usePlayground } from '@/lib/playground-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SEED_USERS } from '@/lib/accounts';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, authLoading, login, register } = usePlayground();

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (user) return <>{children}</>;

  return <AuthScreen login={login} register={register} />;
}

function AuthScreen({
  login,
  register,
}: {
  login: (email: string) => Promise<void>;
  register: (email: string, name: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      await login(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
    setLoading(false);
  }

  async function handleRegister() {
    setError('');
    setLoading(true);
    try {
      await register(email, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
    setLoading(false);
  }

  async function quickLogin(userEmail: string) {
    setError('');
    setLoading(true);
    try {
      await login(userEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
    setLoading(false);
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Artyx AI Gateway</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Credit-based AI playground
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">
              Login
            </TabsTrigger>
            <TabsTrigger value="register" className="flex-1">
              Register
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-3 mt-4">
            <Input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <Button
              onClick={handleLogin}
              disabled={loading || !email}
              className="w-full"
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>

            <div className="pt-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Quick login (test users)
              </p>
              <div className="grid gap-1">
                {SEED_USERS.map((u) => (
                  <button
                    key={u.email}
                    onClick={() => quickLogin(u.email)}
                    disabled={loading}
                    className="text-left px-3 py-2 rounded text-sm hover:bg-muted transition-colors"
                  >
                    <span className="font-medium">{u.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {u.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="register" className="space-y-3 mt-4">
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            />
            <Button
              onClick={handleRegister}
              disabled={loading || !email || !name}
              className="w-full"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </TabsContent>
        </Tabs>

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
