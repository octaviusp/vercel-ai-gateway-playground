import { estimateImageCost, PROBED_LANGUAGE_PRICING } from './pricing';

const HOLD_MULTIPLIER = 1.5;
const MINIMUM_HOLD = 0.0001; // $0.0001 — low floor since we have real per-token rates

// ─── Server-side pricing cache ───
// Fetched once from gateway /v1/models, used for precise hold estimation

type ModelPricingCache = Record<string, { input?: string; output?: string; image?: string }>;
let pricingCache: ModelPricingCache | null = null;
let cachePromise: Promise<void> | null = null;

async function ensurePricingCache(): Promise<ModelPricingCache> {
  if (pricingCache) return pricingCache;
  if (!cachePromise) {
    cachePromise = fetch('https://ai-gateway.vercel.sh/v1/models')
      .then((r) => r.json())
      .then((json) => {
        const cache: ModelPricingCache = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const m of json.data ?? []) {
          if (m.pricing && Object.keys(m.pricing).length > 0) {
            cache[m.id] = m.pricing;
          }
        }
        pricingCache = cache;
        console.log(`\x1b[36m[COST-EST]\x1b[0m Pricing cache loaded: ${Object.keys(cache).length} models`);
      })
      .catch((err) => {
        console.error(`\x1b[31m[COST-EST]\x1b[0m Failed to load pricing cache: ${err}`);
        pricingCache = {}; // Empty cache — will use fallbacks
      });
  }
  await cachePromise;
  return pricingCache!;
}

// Pre-warm on module load
ensurePricingCache();

/**
 * Estimate generation cost for creating a pre-auth hold.
 * Uses real per-token pricing from the gateway for precise estimates.
 *
 * For language models: estimate = inputRate * 100 + outputRate * 500
 * (conservative: assumes ~100 input + ~500 output tokens for a typical request)
 * Then applies 1.5x safety buffer.
 *
 * The real cost from gateway.cost always wins at settlement time.
 */
export function estimateHoldAmount(params: {
  model: string;
  modelType: 'language' | 'image';
  pricing?: { input?: string; output?: string; image?: string };
}): number {
  // Use passed pricing OR look up from cache
  const pricing = params.pricing ?? pricingCache?.[params.model];

  let estimate: number;

  if (params.modelType === 'image') {
    const imgCost = estimateImageCost(params.model);
    estimate = imgCost ?? 0.05;
  } else if (pricing?.input) {
    // Language model with per-token pricing
    // Realistic estimate: ~100 input tokens + ~500 output tokens
    // (much tighter than the old 500+1000 assumption)
    const inputRate = Number(pricing.input);
    const outputRate = Number(pricing.output ?? pricing.input);
    if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate)) {
      estimate = 0.001;
    } else {
      estimate = inputRate * 100 + outputRate * 500;
    }
  } else {
    const probed = PROBED_LANGUAGE_PRICING[params.model];
    if (probed) {
      estimate = probed.free ? 0 : probed.probedCost;
    } else {
      estimate = 0.001; // Unknown model — $0.001 fallback
    }
  }

  // Apply safety multiplier and minimum floor
  const holdAmount = Math.max(estimate * HOLD_MULTIPLIER, MINIMUM_HOLD);

  return Math.round(holdAmount * 1_000_000) / 1_000_000;
}
