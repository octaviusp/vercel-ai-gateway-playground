'use client';

import { useState } from 'react';
import { usePlayground } from '@/lib/playground-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PRESETS = [1, 5, 10, 25] as const;

export default function TopupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { balance, topup } = usePlayground();
  const [amount, setAmount] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleTopup(value: number) {
    setError('');
    setLoading(true);
    try {
      await topup(value);
      setAmount('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Topup failed');
    }
    setLoading(false);
  }

  const numAmount = typeof amount === 'number' ? amount : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Credits</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current balance */}
          <div className="text-center py-2 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground">Current balance</div>
            <div className="text-2xl font-mono tabular-nums font-bold">
              ${balance.toFixed(2)}
            </div>
          </div>

          {/* Preset amounts */}
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                onClick={() => handleTopup(p)}
                disabled={loading}
              >
                ${p}
              </Button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Custom amount"
              min={0.01}
              max={100}
              step={0.01}
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value ? Number(e.target.value) : '')
              }
              className="font-mono"
            />
            <Button
              onClick={() => numAmount > 0 && handleTopup(numAmount)}
              disabled={loading || numAmount <= 0}
            >
              Add
            </Button>
          </div>

          {/* Result preview */}
          {numAmount > 0 && (
            <div className="text-center text-sm text-muted-foreground">
              New balance:{' '}
              <span className="font-mono font-medium text-foreground">
                ${(balance + numAmount).toFixed(2)}
              </span>
            </div>
          )}

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
