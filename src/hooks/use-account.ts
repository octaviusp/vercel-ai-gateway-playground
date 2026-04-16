import { useCallback, useEffect, useRef, useState } from 'react';
import type { Transaction } from '@/lib/ledger';

export function useAccount(userId: string | null, intervalMs = 5000, onAuthLost?: () => void) {
  const [balance, setBalance] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingHolds, setPendingHolds] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTxIds, setNewTxIds] = useState<Set<string>>(new Set());
  const prevTxIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [accRes, txRes] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/account/transactions?limit=30'),
      ]);

      // Detect auth loss — session expired or server restarted
      if (accRes.status === 401 || txRes.status === 401) {
        onAuthLost?.();
        return;
      }

      if (accRes.ok) {
        const acc = await accRes.json();
        setBalance(acc.balance);
        setAvailableBalance(acc.availableBalance);
        setPendingHolds(acc.pendingHolds);
      }

      if (txRes.ok) {
        const tx = await txRes.json();
        const txList: Transaction[] = tx.transactions ?? [];

        // Detect new transactions for animation
        const currentIds = new Set(txList.map((t) => t.id));
        const fresh = new Set<string>();
        for (const id of currentIds) {
          if (!prevTxIdsRef.current.has(id)) fresh.add(id);
        }
        prevTxIdsRef.current = currentIds;
        setNewTxIds(fresh);
        if (fresh.size > 0) {
          setTimeout(() => setNewTxIds(new Set()), 600);
        }

        setTransactions(txList);
      }
    } catch {
      // retry next interval
    } finally {
      setLoading(false);
    }
  }, [userId, onAuthLost]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    refresh();
    const i = setInterval(refresh, intervalMs);
    return () => clearInterval(i);
  }, [userId, refresh, intervalMs]);

  const topup = useCallback(
    async (amount: number) => {
      const res = await fetch('/api/account/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Topup failed');
      }
      await refresh();
    },
    [refresh]
  );

  return {
    balance,
    availableBalance,
    pendingHolds,
    transactions,
    newTxIds,
    loading,
    refresh,
    topup,
  };
}
