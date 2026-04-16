/**
 * Complete pricing map — verified via real gateway probes + API data.
 *
 * Sources:
 * - API models with pricing.input/output/image → used directly
 * - Models with empty pricing → probed via scripts/probe-pricing.ts
 *   on 2026-04-16, real costs captured from providerMetadata.gateway.cost
 *
 * After generation, the REAL cost from gateway always takes priority.
 * This data is for PRE-generation estimates in the UI.
 */

// ─── Probed image model costs (at default ~1 MP) ───

export type ImagePricingEntry = {
  /** Cost per image at default resolution (~1 MP) */
  perImage: number;
  /** Source of pricing data */
  source: 'api' | 'probed';
};

/**
 * All image models with their per-image cost.
 * Includes both API-priced (flat rate) and probed (MP-based at ~1 MP).
 */
export const IMAGE_PRICING: Record<string, ImagePricingEntry> = {
  // BFL FLUX.2 — probed at ~1 MP default output (2026-04-16)
  'bfl/flux-2-pro':      { perImage: 0.030,  source: 'probed' },
  'bfl/flux-2-flex':     { perImage: 0.050,  source: 'probed' },
  'bfl/flux-2-max':      { perImage: 0.070,  source: 'probed' },
  'bfl/flux-2-klein-4b': { perImage: 0.014,  source: 'probed' },
  'bfl/flux-2-klein-9b': { perImage: 0.015,  source: 'probed' },
  // BFL FLUX.1 — flat rate from API
  'bfl/flux-kontext-pro':  { perImage: 0.040, source: 'api' },
  'bfl/flux-kontext-max':  { perImage: 0.080, source: 'api' },
  'bfl/flux-pro-1.0-fill': { perImage: 0.050, source: 'api' },
  'bfl/flux-pro-1.1':      { perImage: 0.040, source: 'api' },
  'bfl/flux-pro-1.1-ultra': { perImage: 0.060, source: 'api' },
  // Prodia — probed
  'prodia/flux-fast-schnell': { perImage: 0.0015, source: 'probed' },
  // Google Imagen — from API
  'google/imagen-4.0-generate-001':      { perImage: 0.040, source: 'api' },
  'google/imagen-4.0-ultra-generate-001': { perImage: 0.060, source: 'api' },
  'google/imagen-4.0-fast-generate-001':  { perImage: 0.020, source: 'api' },
  // Recraft — from API
  'recraft/recraft-v2':     { perImage: 0.022, source: 'api' },
  'recraft/recraft-v3':     { perImage: 0.040, source: 'api' },
  'recraft/recraft-v4':     { perImage: 0.040, source: 'api' },
  'recraft/recraft-v4-pro': { perImage: 0.250, source: 'api' },
  // ByteDance Seedream — from API
  'bytedance/seedream-4.0':      { perImage: 0.030, source: 'api' },
  'bytedance/seedream-4.5':      { perImage: 0.040, source: 'api' },
  'bytedance/seedream-5.0-lite': { perImage: 0.035, source: 'api' },
  // xAI Grok Imagine — from API
  'xai/grok-imagine-image':     { perImage: 0.020, source: 'api' },
  'xai/grok-imagine-image-pro': { perImage: 0.070, source: 'api' },
};

// ─── Probed language model costs (models without API pricing) ───

export type LanguagePricingEntry = {
  /** Probed cost for a minimal request */
  probedCost: number;
  /** Whether it's free */
  free: boolean;
  source: 'probed';
};

export const PROBED_LANGUAGE_PRICING: Record<string, LanguagePricingEntry> = {
  'meituan/longcat-flash-chat':           { probedCost: 0, free: true, source: 'probed' },
  'meituan/longcat-flash-thinking-2601':  { probedCost: 0, free: true, source: 'probed' },
  'zai/glm-4.6v-flash':                  { probedCost: 0, free: true, source: 'probed' },
  'perplexity/sonar':                     { probedCost: 0.00501, free: false, source: 'probed' },
  'perplexity/sonar-pro':                 { probedCost: 0.00611, free: false, source: 'probed' },
  'perplexity/sonar-reasoning-pro':       { probedCost: 0.01091, free: false, source: 'probed' },
};

// ─── Public API ───

/**
 * Get pricing display for ANY model — returns a formatted string.
 * Covers: API token pricing, API image pricing, probed image pricing,
 * probed language pricing, and "free" models.
 */
export function getModelPriceLabel(
  modelId: string,
  apiPricing?: { input?: string; output?: string; image?: string }
): string | null {
  // 1. API token pricing (language models)
  if (apiPricing?.input) {
    const inM = (Number(apiPricing.input) * 1_000_000).toFixed(2);
    const outM = apiPricing.output
      ? (Number(apiPricing.output) * 1_000_000).toFixed(2)
      : '?';
    return `$${inM}/$${outM} per M`;
  }

  // 2. API image pricing (flat rate)
  if (apiPricing?.image) {
    return `$${apiPricing.image}/img`;
  }

  // 3. Probed image pricing
  const imgPrice = IMAGE_PRICING[modelId];
  if (imgPrice) {
    const label = imgPrice.source === 'probed' ? '/img ~1MP' : '/img';
    return `$${imgPrice.perImage.toFixed(3)}${label}`;
  }

  // 4. Probed language pricing
  const langPrice = PROBED_LANGUAGE_PRICING[modelId];
  if (langPrice) {
    return langPrice.free ? 'FREE' : `~$${langPrice.probedCost.toFixed(4)}/req`;
  }

  return null;
}

/**
 * Get estimated cost for an image generation.
 * Works for ALL image models — both flat-rate and MP-based.
 */
export function estimateImageCost(modelId: string): number | null {
  const entry = IMAGE_PRICING[modelId];
  return entry?.perImage ?? null;
}
