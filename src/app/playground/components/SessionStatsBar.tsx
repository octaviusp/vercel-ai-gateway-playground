'use client';

import { usePlayground } from '@/lib/playground-context';
import { Activity, CircleDollarSign, Clock, Cpu, Wallet } from 'lucide-react';

function StatCell({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs tabular-nums font-medium ${className ?? ''}`}>
        {value}
      </span>
    </div>
  );
}

function balanceColor(b: number): string {
  if (b > 1) return 'text-emerald-400';
  if (b > 0.1) return 'text-amber-400';
  return 'text-red-400';
}

export default function SessionStatsBar() {
  const { sessionStats, balance, user } = usePlayground();

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b bg-card/50">
      <div className="flex items-center gap-1 px-4">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase mr-2">
          Session
        </span>
        <StatCell
          icon={CircleDollarSign}
          label="Spent"
          value={`$${sessionStats.totalCost.toFixed(6)}`}
        />
        <div className="h-4 w-px bg-border" />
        <StatCell
          icon={Activity}
          label="Reqs"
          value={sessionStats.totalRequests.toString()}
        />
        <div className="h-4 w-px bg-border" />
        <StatCell
          icon={Clock}
          label="Avg"
          value={`${Math.round(sessionStats.avgLatencyMs)}ms`}
        />
        <div className="h-4 w-px bg-border" />
        <StatCell
          icon={Cpu}
          label="Tokens"
          value={`${(sessionStats.totalInputTokens + sessionStats.totalOutputTokens).toLocaleString()}`}
        />
      </div>

      {user && (
        <div className="flex items-center gap-2 px-4">
          <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={`font-mono text-sm tabular-nums font-bold ${balanceColor(balance)}`}>
            ${balance.toFixed(6)}
          </span>
          <span className="text-xs text-muted-foreground">{user.name}</span>
        </div>
      )}
    </div>
  );
}
