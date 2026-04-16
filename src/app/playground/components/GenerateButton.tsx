'use client';

import { usePlayground } from '@/lib/playground-context';
import { useElapsedTimer } from '@/hooks/use-elapsed-timer';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, Loader2, X, Zap } from 'lucide-react';
import { estimateImageCost } from '@/lib/pricing';

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function GenerationTimer() {
  const { status, startTime, isRunning, lastMeta } = usePlayground();
  const elapsed = useElapsedTimer(startTime, isRunning);

  if (status === 'idle') return null;

  if (status === 'generating') {
    return (
      <div className="flex items-center gap-1.5 text-sm font-mono tabular-nums text-blue-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
        </span>
        {formatMs(elapsed)}
      </div>
    );
  }

  if (status === 'complete') {
    const latency = lastMeta?.latencyMs ?? elapsed;
    return (
      <div className="flex items-center gap-1.5 text-sm font-mono tabular-nums text-emerald-400">
        <Check className="h-3.5 w-3.5" />
        {formatMs(latency)}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm font-mono tabular-nums text-red-400">
      <X className="h-3.5 w-3.5" />
      {formatMs(elapsed)}
    </div>
  );
}

function CostInfo() {
  const { selectedModel, mode, availableBalance, insufficientFunds } = usePlayground();

  const parts: string[] = [];

  // Cost estimate for image models
  if (mode === 'image') {
    const cost = estimateImageCost(selectedModel);
    if (cost !== null) parts.push(`~$${cost.toFixed(3)}/img`);
  }

  // Available balance
  parts.push(`Available: $${availableBalance.toFixed(6)}`);

  return (
    <div className="flex items-center gap-2">
      {insufficientFunds && (
        <span className="text-[10px] text-red-400 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Insufficient funds
        </span>
      )}
      <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
        {parts.join(' · ')}
      </span>
    </div>
  );
}

export default function GenerateButton() {
  const { status, prompt, runGeneration, mode, availableBalance, insufficientFunds } =
    usePlayground();
  const isGenerating = status === 'generating';
  const tooLow = availableBalance < 0.005;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 flex flex-col gap-1">
        <Button
          onClick={runGeneration}
          disabled={isGenerating || !prompt.trim() || tooLow}
          className="w-full"
          variant={insufficientFunds || tooLow ? 'destructive' : 'default'}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating...
            </>
          ) : tooLow ? (
            <>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Add credits to continue
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Generate {mode === 'image' ? 'image' : 'text'}
              <kbd className="ml-2 text-[10px] opacity-50 border rounded px-1">
                {'\u2318'}Enter
              </kbd>
            </>
          )}
        </Button>
        <CostInfo />
      </div>
      <div className="w-20 flex justify-end">
        <GenerationTimer />
      </div>
    </div>
  );
}
