'use client';

import { usePlayground } from '@/lib/playground-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Transaction, TransactionType, TransactionStatus } from '@/lib/ledger';

const TYPE_STYLES: Record<TransactionType, { label: string; className: string }> = {
  topup:   { label: 'TOPUP',   className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  hold:    { label: 'HOLD',    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  charge:  { label: 'CHARGE',  className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  release: { label: 'RELEASE', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  refund:  { label: 'REFUND',  className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

const STATUS_DOT: Record<TransactionStatus, string> = {
  pending: 'bg-amber-400',
  settled: 'bg-emerald-400',
  voided:  'bg-zinc-500',
};

/** Format amount to show every significant digit — never round away real cost */
function fmtAmount(n: number): string {
  const abs = Math.abs(n);
  if (abs === 0) return '$0.00';
  if (abs >= 1) return `$${abs.toFixed(2)}`;
  if (abs >= 0.01) return `$${abs.toFixed(4)}`;
  // For micro-costs like $0.000027 — show 6 digits
  return `$${abs.toFixed(6)}`;
}

function TxRow({ tx, isNew }: { tx: Transaction; isNew: boolean }) {
  const style = TYPE_STYLES[tx.type];
  const isPositive = tx.amount > 0;
  const isVoided = tx.status === 'voided';

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs ${
        isNew ? 'animate-slide-in bg-primary/5' : ''
      } ${isVoided ? 'opacity-40' : ''}`}
    >
      {/* Status dot */}
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[tx.status]}`} />

      {/* Time */}
      <span className="text-muted-foreground w-10 shrink-0 font-mono tabular-nums">
        {new Date(tx.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>

      {/* Type badge */}
      <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 ${style.className}`}>
        {style.label}
      </Badge>

      {/* Model or description */}
      <span className="truncate flex-1 min-w-0 text-muted-foreground font-mono">
        {tx.metadata.model
          ? tx.metadata.model.split('/').pop()
          : tx.metadata.description?.slice(0, 30) ?? ''}
      </span>

      {/* Amount — full precision, never hide micro-costs */}
      <span
        className={`shrink-0 font-mono tabular-nums font-medium ${
          isPositive ? 'text-emerald-400' : ''
        }`}
      >
        {isPositive ? '+' : '-'}{fmtAmount(tx.amount)}
      </span>
    </div>
  );
}

export default function TransactionFeed() {
  const { transactions, newTxIds } = usePlayground();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Transactions
        </span>
      </div>

      <ScrollArea className="flex-1">
        {transactions.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No transactions yet
          </div>
        ) : (
          <div className="p-1">
            {transactions.map((tx) => (
              <TxRow
                key={tx.id}
                tx={tx}
                isNew={newTxIds.has(tx.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
