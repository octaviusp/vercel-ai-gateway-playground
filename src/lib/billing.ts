import { randomUUID } from 'crypto';
import type { ModelType } from './models';

export type UsageLogEntry = {
  generation_id?: string | null;
  model_id: string;
  model_type: ModelType;
  operation: 'generateText' | 'streamText' | 'generateImage' | 'embed';
  prompt_preview?: string;
  input_tokens?: number;
  output_tokens?: number;
  cached_input_tokens?: number;
  reasoning_tokens?: number;
  image_count?: number;
  latency_ms?: number;
  cost_usd?: number;
  market_cost_usd?: number;
  provider_used?: string;
  status?: 'success' | 'error';
  error_message?: string;
  raw_metadata?: unknown;
};

export type UsageRow = UsageLogEntry & {
  id: string;
  created_at: string;
  status: 'success' | 'error';
};

// In-memory store — persists for the lifetime of the server process
const store: UsageRow[] = [];

export function logUsage(entry: UsageLogEntry) {
  store.unshift({
    ...entry,
    id: randomUUID(),
    created_at: new Date().toISOString(),
    status: entry.status ?? 'success',
  });
}

export function getUsage(opts?: { limit?: number; model?: string }): UsageRow[] {
  let rows = store;
  if (opts?.model) rows = rows.filter((r) => r.model_id === opts.model);
  return rows.slice(0, opts?.limit ?? 50);
}

export function getAllUsage(limit = 500): UsageRow[] {
  return store.slice(0, limit);
}
