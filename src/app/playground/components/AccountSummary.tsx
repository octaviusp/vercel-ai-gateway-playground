'use client';

import { usePlayground } from '@/lib/playground-context';
import { Button } from '@/components/ui/button';
import { CircleDollarSign, Plus, LogOut } from 'lucide-react';

function balanceColor(balance: number): string {
  if (balance > 1) return 'text-emerald-400';
  if (balance > 0.1) return 'text-amber-400';
  return 'text-red-400';
}

export default function AccountSummary({
  onTopup,
}: {
  onTopup: () => void;
}) {
  const { user, balance, availableBalance, logout } = usePlayground();

  if (!user) return null;

  const hasPending = Math.abs(balance - availableBalance) > 0.000001;

  return (
    <div className="p-3 border-b space-y-3">
      {/* User info */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-[10px] text-muted-foreground">{user.email}</div>
        </div>
        <button
          onClick={logout}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Logout"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className={`text-lg font-mono tabular-nums font-bold ${balanceColor(balance)}`}>
              ${balance.toFixed(6)}
            </div>
            {hasPending && (
              <div className="text-[10px] text-amber-400/70 font-mono tabular-nums">
                ${availableBalance.toFixed(6)} available
              </div>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onTopup}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}
