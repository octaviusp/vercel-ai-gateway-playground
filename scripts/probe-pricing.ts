/**
 * Pricing Probe Script
 *
 * 1. Fetches ALL models from Vercel AI Gateway
 * 2. Identifies which ones are missing pricing data
 * 3. Makes a MINIMAL request to each (1-token text, tiny image)
 * 4. Captures real cost from providerMetadata.gateway
 * 5. Outputs a complete pricing JSON + markdown table
 *
 * Usage: npx tsx scripts/probe-pricing.ts
 * Requires: AI_GATEWAY_API_KEY in .env.local
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { generateText, experimental_generateImage as generateImage } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { writeFileSync } from 'fs';

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

// ─── Types ───

type ModelEntry = {
  id: string;
  name: string;
  type: string;
  owned_by: string;
  pricing: Record<string, string>;
  tags?: string[];
};

type PricingResult = {
  modelId: string;
  name: string;
  type: string;
  source: 'api' | 'probed' | 'failed';
  // From API pricing field
  apiPricing: Record<string, string>;
  // From real gateway call
  probedCost?: number;
  probedMarketCost?: number;
  probedProvider?: string;
  probedTokensIn?: number;
  probedTokensOut?: number;
  probedImageCount?: number;
  // Error info
  error?: string;
  // Calculated
  estimatedCostPer1kTokensIn?: number;
  estimatedCostPer1kTokensOut?: number;
  estimatedCostPerImage?: number;
  estimatedCostPerMp?: number;
};

// ─── Fetch all models ───

async function fetchAllModels(): Promise<ModelEntry[]> {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/models');
  const json = await res.json();
  return (json.data ?? []).map((m: any) => ({
    id: m.id,
    name: m.name ?? m.id,
    type: m.type ?? 'language',
    owned_by: m.owned_by ?? 'unknown',
    pricing: m.pricing ?? {},
    tags: m.tags ?? [],
  }));
}

function hasPricing(m: ModelEntry): boolean {
  return Object.keys(m.pricing).length > 0 &&
    Object.values(m.pricing).some(v => v != null && v !== '' && v !== '0');
}

// ─── Probe a language model ───

async function probeLanguageModel(modelId: string): Promise<Partial<PricingResult>> {
  try {
    const result = await generateText({
      model: gateway(modelId),
      prompt: 'Say "ok"',
      maxTokens: 5,
    });

    const gw = (result.providerMetadata?.gateway as any) ?? {};

    return {
      source: 'probed',
      probedCost: gw.cost ? Number(gw.cost) : undefined,
      probedMarketCost: gw.marketCost ? Number(gw.marketCost) : undefined,
      probedProvider: gw.provider ?? gw.providerName,
      probedTokensIn: result.usage.inputTokens,
      probedTokensOut: result.usage.outputTokens,
      estimatedCostPer1kTokensIn:
        gw.cost && result.usage.inputTokens
          ? (Number(gw.cost) / (result.usage.inputTokens + result.usage.outputTokens)) * 1000
          : undefined,
    };
  } catch (err: any) {
    return { source: 'failed', error: err?.message?.slice(0, 200) ?? 'unknown' };
  }
}

// ─── Probe an image model ───

async function probeImageModel(modelId: string): Promise<Partial<PricingResult>> {
  try {
    const result = await generateImage({
      model: gateway.imageModel(modelId),
      prompt: 'A red dot on white background',
      size: '512x512',
      n: 1,
    });

    const gw = (result.providerMetadata?.gateway as any) ?? {};

    return {
      source: 'probed',
      probedCost: gw.cost ? Number(gw.cost) : undefined,
      probedMarketCost: gw.marketCost ? Number(gw.marketCost) : undefined,
      probedProvider: gw.provider ?? gw.providerName,
      probedImageCount: result.images.length,
      estimatedCostPerImage: gw.cost ? Number(gw.cost) / (result.images.length || 1) : undefined,
      // At 512x512 = 0.26 MP → estimate per-MP cost
      estimatedCostPerMp: gw.cost ? Number(gw.cost) / 0.2621 : undefined,
    };
  } catch (err: any) {
    // Some models don't support size param — retry without it
    try {
      const result = await generateImage({
        model: gateway.imageModel(modelId),
        prompt: 'A red dot on white background',
        n: 1,
      });

      const gw = (result.providerMetadata?.gateway as any) ?? {};

      return {
        source: 'probed',
        probedCost: gw.cost ? Number(gw.cost) : undefined,
        probedMarketCost: gw.marketCost ? Number(gw.marketCost) : undefined,
        probedProvider: gw.provider ?? gw.providerName,
        probedImageCount: result.images.length,
        estimatedCostPerImage: gw.cost ? Number(gw.cost) / (result.images.length || 1) : undefined,
        // Default output is ~1 MP
        estimatedCostPerMp: gw.cost ? Number(gw.cost) : undefined,
      };
    } catch (err2: any) {
      return { source: 'failed', error: err2?.message?.slice(0, 200) ?? 'unknown' };
    }
  }
}

// ─── Main ───

async function main() {
  console.log('🔍 Fetching all models from Vercel AI Gateway...\n');
  const allModels = await fetchAllModels();
  console.log(`   Found ${allModels.length} models total.\n`);

  // Classify
  const withPricing = allModels.filter(hasPricing);
  const withoutPricing = allModels.filter(m => !hasPricing(m));

  console.log(`   ✅ ${withPricing.length} models with pricing data from API`);
  console.log(`   ❌ ${withoutPricing.length} models WITHOUT pricing — will probe these\n`);

  // Probe models without pricing
  const results: PricingResult[] = [];

  // First, add models that already have pricing
  for (const m of withPricing) {
    results.push({
      modelId: m.id,
      name: m.name,
      type: m.type,
      source: 'api',
      apiPricing: m.pricing,
    });
  }

  // Then probe the ones without
  console.log('💸 Probing models without pricing (minimal requests)...\n');

  for (const m of withoutPricing) {
    const label = `   [${results.length - withPricing.length + 1}/${withoutPricing.length}] ${m.id}`;
    process.stdout.write(`${label} ...`);

    let probeResult: Partial<PricingResult>;

    if (m.type === 'image') {
      probeResult = await probeImageModel(m.id);
    } else {
      probeResult = await probeLanguageModel(m.id);
    }

    const entry: PricingResult = {
      modelId: m.id,
      name: m.name,
      type: m.type,
      apiPricing: m.pricing,
      ...probeResult,
    } as PricingResult;

    results.push(entry);

    if (probeResult.source === 'probed') {
      const cost = probeResult.probedCost;
      console.log(` ✅ cost=$${cost?.toFixed(6) ?? 'N/A'}`);
    } else {
      console.log(` ❌ ${probeResult.error?.slice(0, 80)}`);
    }
  }

  // ─── Generate reports ───

  // Save raw JSON
  const jsonPath = resolve(process.cwd(), 'scripts/pricing-results.json');
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Raw results saved to ${jsonPath}`);

  // Generate markdown summary
  const md = generateMarkdownReport(results, withoutPricing);
  const mdPath = resolve(process.cwd(), 'scripts/pricing-report.md');
  writeFileSync(mdPath, md);
  console.log(`📊 Report saved to ${mdPath}`);

  // Generate pricing map for lib/pricing.ts
  const pricingMap = generatePricingMap(results);
  const mapPath = resolve(process.cwd(), 'scripts/pricing-map.json');
  writeFileSync(mapPath, JSON.stringify(pricingMap, null, 2));
  console.log(`🗺️  Pricing map saved to ${mapPath}`);

  // Summary
  const probed = results.filter(r => r.source === 'probed');
  const failed = results.filter(r => r.source === 'failed');
  const totalSpent = probed.reduce((s, r) => s + (r.probedCost ?? 0), 0);

  console.log(`\n═══════════════════════════════════`);
  console.log(`📊 SUMMARY`);
  console.log(`   Models with API pricing: ${withPricing.length}`);
  console.log(`   Models probed:           ${probed.length}`);
  console.log(`   Models failed:           ${failed.length}`);
  console.log(`   Total spent probing:     $${totalSpent.toFixed(6)}`);
  console.log(`═══════════════════════════════════\n`);
}

function generateMarkdownReport(results: PricingResult[], probed: ModelEntry[]): string {
  const lines: string[] = [
    '# Artyx AI Gateway — Complete Pricing Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Models with API pricing (from /v1/models)',
    '',
    '| Model | Type | Input/M | Output/M | Image | Other |',
    '|-------|------|---------|----------|-------|-------|',
  ];

  for (const r of results.filter(r => r.source === 'api')) {
    const p = r.apiPricing;
    const inputM = p.input ? `$${(Number(p.input) * 1e6).toFixed(2)}` : '-';
    const outputM = p.output ? `$${(Number(p.output) * 1e6).toFixed(2)}` : '-';
    const img = p.image ? `$${p.image}` : '-';
    const other = Object.entries(p)
      .filter(([k]) => !['input', 'output', 'image'].includes(k))
      .map(([k, v]) => `${k}=${v}`)
      .join(', ') || '-';
    lines.push(`| \`${r.modelId}\` | ${r.type} | ${inputM} | ${outputM} | ${img} | ${other} |`);
  }

  lines.push('', '## Models probed (real gateway cost captured)', '');
  lines.push('| Model | Type | Probed Cost | Market Cost | Provider | Tokens In/Out | Details |');
  lines.push('|-------|------|-------------|-------------|----------|---------------|---------|');

  for (const r of results.filter(r => r.source === 'probed')) {
    const cost = r.probedCost != null ? `$${r.probedCost.toFixed(6)}` : 'N/A';
    const market = r.probedMarketCost != null ? `$${r.probedMarketCost.toFixed(6)}` : '-';
    const provider = r.probedProvider ?? '-';
    const tokens = r.probedTokensIn != null ? `${r.probedTokensIn}/${r.probedTokensOut ?? 0}` : '-';
    const details: string[] = [];
    if (r.estimatedCostPerMp != null) details.push(`~$${r.estimatedCostPerMp.toFixed(4)}/MP`);
    if (r.estimatedCostPerImage != null) details.push(`~$${r.estimatedCostPerImage.toFixed(4)}/img`);
    if (r.estimatedCostPer1kTokensIn != null) details.push(`~$${r.estimatedCostPer1kTokensIn.toFixed(4)}/1k tok`);
    lines.push(`| \`${r.modelId}\` | ${r.type} | ${cost} | ${market} | ${provider} | ${tokens} | ${details.join(', ') || '-'} |`);
  }

  lines.push('', '## Failed to probe', '');
  for (const r of results.filter(r => r.source === 'failed')) {
    lines.push(`- \`${r.modelId}\` (${r.type}): ${r.error}`);
  }

  return lines.join('\n');
}

function generatePricingMap(results: PricingResult[]): Record<string, {
  type: string;
  source: string;
  inputPerMillion?: number;
  outputPerMillion?: number;
  perImage?: number;
  perMegapixel?: number;
  probedCost?: number;
}> {
  const map: Record<string, any> = {};

  for (const r of results) {
    if (r.source === 'api') {
      const p = r.apiPricing;
      map[r.modelId] = {
        type: r.type,
        source: 'api',
        ...(p.input && { inputPerMillion: Number(p.input) * 1e6 }),
        ...(p.output && { outputPerMillion: Number(p.output) * 1e6 }),
        ...(p.image && { perImage: Number(p.image) }),
      };
    } else if (r.source === 'probed') {
      map[r.modelId] = {
        type: r.type,
        source: 'probed',
        probedCost: r.probedCost,
        ...(r.estimatedCostPerMp != null && { perMegapixel: Number(r.estimatedCostPerMp.toFixed(4)) }),
        ...(r.estimatedCostPerImage != null && { perImage: Number(r.estimatedCostPerImage.toFixed(4)) }),
        ...(r.estimatedCostPer1kTokensIn != null && { per1kTokens: Number(r.estimatedCostPer1kTokensIn.toFixed(4)) }),
      };
    }
  }

  return map;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
