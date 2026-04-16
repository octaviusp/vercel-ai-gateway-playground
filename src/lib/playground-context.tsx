'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { GatewayModel } from './models';
import type { Account } from './accounts';
import type { Transaction } from './ledger';
import { useAuth } from '@/hooks/use-auth';
import { useAccount } from '@/hooks/use-account';
import { useBillingPoll, type SessionStats } from '@/hooks/use-billing-poll';
import type { UsageRow } from '@/lib/billing';

// ─── Types ───

export type GenerationMode = 'text' | 'image';
export type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

export type GenerationMeta = {
  model: string;
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  latencyMs?: number;
  costUsd?: number;
  providerUsed?: string;
};

type PlaygroundContextValue = {
  // Auth
  user: Account | null;
  authLoading: boolean;
  login: (email: string) => Promise<void>;
  register: (email: string, name: string) => Promise<void>;
  logout: () => void;

  // Account / Credits
  balance: number;
  availableBalance: number;
  transactions: Transaction[];
  newTxIds: Set<string>;
  topup: (amount: number) => Promise<void>;
  refreshAccount: () => Promise<void>;
  insufficientFunds: boolean;

  // Models
  models: GatewayModel[];
  modelsLoading: boolean;
  mode: GenerationMode;
  selectedModel: string;

  // Generation
  status: GenerationStatus;
  prompt: string;
  systemPrompt: string;
  output: string;
  images: Array<{ base64: string; mediaType: string }>;
  errorMsg: string;

  // Timer
  startTime: number | null;
  isRunning: boolean;
  lastMeta: GenerationMeta | null;

  // Image options
  aspectRatio: string;

  // Billing telemetry (legacy — raw gateway data)
  billingFeed: UsageRow[];
  sessionStats: SessionStats;
  newBillingIds: Set<string>;

  // Actions
  setMode: (m: GenerationMode) => void;
  setSelectedModel: (id: string) => void;
  setPrompt: (p: string) => void;
  setSystemPrompt: (p: string) => void;
  setAspectRatio: (a: string) => void;
  runGeneration: () => Promise<void>;
  refreshBilling: () => Promise<void>;
};

const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

export function usePlayground() {
  const ctx = useContext(PlaygroundContext);
  if (!ctx) throw new Error('usePlayground must be used within PlaygroundProvider');
  return ctx;
}

// ─── Helpers ───

function detectMode(model: GatewayModel | undefined): GenerationMode {
  if (!model) return 'text';
  if (model.type === 'image') return 'image';
  if (model.tags?.includes('vision') && model.id.includes('image')) return 'image';
  return 'text';
}

// ─── Provider ───

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  // Auth
  const { user, loading: authLoading, login, register, logout } = useAuth();

  // Account / Credits
  const {
    balance,
    availableBalance,
    transactions,
    newTxIds,
    refresh: refreshAccount,
    topup,
  } = useAccount(user?.id ?? null, 5000, logout);
  const [insufficientFunds, setInsufficientFunds] = useState(false);

  // Models
  const [models, setModels] = useState<GatewayModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [mode, setMode] = useState<GenerationMode>('text');
  const [selectedModel, setSelectedModelRaw] = useState('');

  // Generation
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [images, setImages] = useState<Array<{ base64: string; mediaType: string }>>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Timer
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastMeta, setLastMeta] = useState<GenerationMeta | null>(null);

  // Image options
  const [aspectRatio, setAspectRatio] = useState('1:1');

  // Billing telemetry
  const { feed: billingFeed, stats: sessionStats, newIds: newBillingIds, refresh: refreshBilling } =
    useBillingPoll(5000);

  const abortRef = useRef<AbortController | null>(null);
  const generatingLockRef = useRef(false); // Sync lock to prevent rapid double-click

  // Fetch models on mount
  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => {
        const m: GatewayModel[] = d.models ?? [];
        setModels(m);
        if (m.length > 0) {
          setSelectedModelRaw(m[0].id);
          setMode(detectMode(m[0]));
        }
        setModelsLoading(false);
      })
      .catch(() => setModelsLoading(false));
  }, []);

  const setSelectedModel = useCallback(
    (id: string) => {
      setSelectedModelRaw(id);
      const model = models.find((m) => m.id === id);
      setMode(detectMode(model));
    },
    [models]
  );

  const runGeneration = useCallback(async () => {
    if (!prompt.trim() || status === 'generating') return;
    // Synchronous lock — prevents double-fire from rapid clicks within same render
    if (generatingLockRef.current) return;
    generatingLockRef.current = true;

    // Reset
    setOutput('');
    setImages([]);
    setErrorMsg('');
    setLastMeta(null);
    setInsufficientFunds(false);
    setStatus('generating');
    setStartTime(Date.now());
    setIsRunning(true);

    abortRef.current = new AbortController();

    try {
      if (mode === 'text') {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            prompt,
            system: systemPrompt || undefined,
          }),
          signal: abortRef.current.signal,
        });

        // Handle insufficient funds
        if (res.status === 402) {
          const data = await res.json();
          setInsufficientFunds(true);
          throw new Error(
            `Insufficient funds: $${data.available?.toFixed(4)} available, $${data.required?.toFixed(4)} required`
          );
        }

        if (!res.ok) {
          const err = await res.text();
          throw new Error(err || `HTTP ${res.status}`);
        }

        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        while (!done) {
          const chunk = await reader.read();
          done = chunk.done;
          if (chunk.value) {
            setOutput((o) => o + decoder.decode(chunk.value));
          }
        }

        setIsRunning(false);
        setStatus('complete');
      } else {
        const modelObj = models.find((m) => m.id === selectedModel);
        const modelType = modelObj?.type === 'image' ? 'image' : 'language';

        const res = await fetch('/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            modelType,
            prompt,
            aspectRatio,
          }),
          signal: abortRef.current.signal,
        });

        // Handle insufficient funds
        if (res.status === 402) {
          const data = await res.json();
          setInsufficientFunds(true);
          throw new Error(
            `Insufficient funds: $${data.available?.toFixed(4)} available, $${data.required?.toFixed(4)} required`
          );
        }

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? 'Generation failed');
        }

        if (data.images) setImages(data.images);
        if (data.text) setOutput(data.text);

        setIsRunning(false);
        setStatus('complete');
      }

      // Refresh both account and billing
      setTimeout(() => {
        refreshBilling();
        refreshAccount();
      }, 500);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('idle');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
      setIsRunning(false);
      setTimeout(() => {
        refreshBilling();
        refreshAccount();
      }, 500);
    } finally {
      generatingLockRef.current = false;
    }
  }, [
    prompt,
    systemPrompt,
    selectedModel,
    mode,
    aspectRatio,
    status,
    models,
    refreshBilling,
    refreshAccount,
  ]);

  // Update lastMeta from billing feed when generation completes
  useEffect(() => {
    if (status === 'complete' && billingFeed.length > 0) {
      const latest = billingFeed[0];
      if (latest.model_id === selectedModel) {
        setLastMeta({
          model: latest.model_id,
          operation: latest.operation,
          inputTokens: latest.input_tokens ?? undefined,
          outputTokens: latest.output_tokens ?? undefined,
          imageCount: latest.image_count ?? undefined,
          latencyMs: latest.latency_ms ?? undefined,
          costUsd: latest.cost_usd ?? undefined,
          providerUsed: latest.provider_used ?? undefined,
        });
      }
    }
  }, [status, billingFeed, selectedModel]);

  return (
    <PlaygroundContext.Provider
      value={{
        // Auth
        user,
        authLoading,
        login,
        register,
        logout,
        // Account
        balance,
        availableBalance,
        transactions,
        newTxIds,
        topup,
        refreshAccount,
        insufficientFunds,
        // Models
        models,
        modelsLoading,
        mode,
        selectedModel,
        // Generation
        status,
        prompt,
        systemPrompt,
        output,
        images,
        errorMsg,
        // Timer
        startTime,
        isRunning,
        lastMeta,
        // Image
        aspectRatio,
        // Billing telemetry
        billingFeed,
        sessionStats,
        newBillingIds,
        // Actions
        setMode,
        setSelectedModel,
        setPrompt,
        setSystemPrompt,
        setAspectRatio,
        runGeneration,
        refreshBilling,
      }}
    >
      {children}
    </PlaygroundContext.Provider>
  );
}
