import { useCallback, useEffect, useRef, useState } from 'react';
import type { UsageRow } from '@/lib/billing';

export type SessionStats = {
  totalCost: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalImages: number;
  totalErrors: number;
  avgLatencyMs: number;
};

const EMPTY_STATS: SessionStats = {
  totalCost: 0,
  totalRequests: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalImages: 0,
  totalErrors: 0,
  avgLatencyMs: 0,
};

export function useBillingPoll(intervalMs = 5000) {
  const [feed, setFeed] = useState<UsageRow[]>([]);
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/usage?limit=20');
      const j = await r.json();
      const rows: UsageRow[] = j.rows ?? [];

      // Detect new entries for animation
      const currentIds = new Set(rows.map((r) => r.id));
      const fresh = new Set<string>();
      for (const id of currentIds) {
        if (!prevIdsRef.current.has(id)) fresh.add(id);
      }
      prevIdsRef.current = currentIds;
      setNewIds(fresh);

      // Clear animation class after 600ms
      if (fresh.size > 0) {
        setTimeout(() => setNewIds(new Set()), 600);
      }

      setFeed(rows);
      if (j.totals) {
        const t = j.totals;
        setStats({
          totalCost: t.totalCost,
          totalRequests: t.totalRequests,
          totalInputTokens: t.totalInputTokens,
          totalOutputTokens: t.totalOutputTokens,
          totalImages: t.totalImages,
          totalErrors: t.totalErrors,
          avgLatencyMs:
            t.totalRequests > 0
              ? rows.reduce((s: number, r: UsageRow) => s + (r.latency_ms ?? 0), 0) /
                t.totalRequests
              : 0,
        });
      }
    } catch {
      // silently retry on next interval
    }
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, intervalMs);
    return () => clearInterval(i);
  }, [refresh, intervalMs]);

  return { feed, stats, newIds, refresh };
}
