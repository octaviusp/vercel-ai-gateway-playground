'use client';

import { useMemo, useState } from 'react';
import { usePlayground } from '@/lib/playground-context';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronDown } from 'lucide-react';
import type { GatewayModel } from '@/lib/models';
import { getModelPriceLabel } from '@/lib/pricing';

function PricingBadge({ model }: { model: GatewayModel }) {
  const label = getModelPriceLabel(model.id, model.pricing);

  if (!label) return null;

  // Free models → green
  if (label === 'FREE') {
    return (
      <Badge variant="outline" className="text-[10px] px-1 py-0 text-emerald-400 border-emerald-400/30">
        FREE
      </Badge>
    );
  }

  // Probed models (no API pricing) → amber to signal "estimated"
  if (label.includes('~')) {
    return (
      <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-400 border-amber-400/30">
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-[10px] px-1 py-0">
      {label}
    </Badge>
  );
}

function groupByProvider(models: GatewayModel[]) {
  const groups: Record<string, GatewayModel[]> = {};
  for (const m of models) {
    const provider = m.id.split('/')[0] ?? 'other';
    groups[provider] = groups[provider] ?? [];
    groups[provider].push(m);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export default function ModelSelectorCompact() {
  const { models, selectedModel, setSelectedModel, mode } = usePlayground();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const currentModel = models.find((m) => m.id === selectedModel);
  const currentPriceLabel = currentModel
    ? getModelPriceLabel(currentModel.id, currentModel.pricing)
    : null;

  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(lower) ||
        m.name.toLowerCase().includes(lower)
    );
  }, [models, q]);

  const groups = useMemo(() => groupByProvider(filtered), [filtered]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(true); }}
        className="group/button inline-flex w-full items-center justify-between rounded-lg border bg-card px-3 h-9 font-mono text-sm cursor-pointer hover:bg-accent transition-colors"
      >
        <span className="flex items-center gap-2 truncate">
          <span className="truncate">{currentModel?.id ?? 'Select model'}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {mode}
          </Badge>
          {currentPriceLabel && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {currentPriceLabel}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </div>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="text-sm font-medium">Select model</DialogTitle>
        </DialogHeader>
        <div className="px-4 py-2">
          <Input
            placeholder="Search models..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="overflow-y-auto px-2 pb-3 flex-1">
          {groups.map(([provider, items]) => (
            <div key={provider} className="mb-2">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {provider}
              </div>
              {items.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedModel(m.id);
                    setOpen(false);
                    setQ('');
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between gap-2 ${
                    selectedModel === m.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-xs truncate">{m.id}</span>
                    {m.name !== m.id && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {m.name}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1 py-0"
                    >
                      {m.type}
                    </Badge>
                    <PricingBadge model={m} />
                  </div>
                </button>
              ))}
            </div>
          ))}
          {groups.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No models found
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
