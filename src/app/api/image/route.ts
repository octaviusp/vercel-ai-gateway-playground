import { experimental_generateImage as generateImage, generateText } from 'ai';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { gateway } from '@/lib/gateway';
import { logUsage } from '@/lib/billing';
import { requireAuth, AuthError } from '@/lib/auth';
import { createGenerationHold, settleGeneration, releaseHold } from '@/lib/billing-flow';
import { ensureSeeded } from '@/lib/accounts';

export const maxDuration = 120;

const TAG = '\x1b[95m[API/IMAGE]\x1b[0m';

/** Extract provider from gateway routing metadata */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractProvider(gw: any): string {
  return gw?.routing?.finalProvider ?? gw?.routing?.resolvedProvider ?? gw?.provider ?? gw?.providerName ?? 'unknown';
}

type ImageRequest = {
  model: string;
  modelType: 'image' | 'language';
  prompt: string;
  aspectRatio?: '1:1' | '4:3' | '16:9' | '9:16' | '3:4';
  n?: number;
};

/**
 * Map aspect ratio to pixel dimensions at ~1 MP.
 * BFL FLUX models need explicit width/height (multiples of 16).
 * The aspectRatio param alone doesn't control output for all providers.
 */
const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 },
  '4:3':  { width: 1184, height: 880 },
  '3:4':  { width: 880, height: 1184 },
  '16:9': { width: 1360, height: 768 },
  '9:16': { width: 768, height: 1360 },
};

export async function POST(req: NextRequest) {
  ensureSeeded();

  // ─── Auth ───
  let accountId: string;
  let accountName: string;
  try {
    const { account } = requireAuth(req);
    accountId = account.id;
    accountName = account.name;
  } catch (err) {
    console.log(`${TAG} ✗ AUTH FAILED`);
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Auth failed' }, { status: 401 });
  }

  let body: ImageRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.model || typeof body.model !== 'string') {
    return NextResponse.json({ error: 'model is required' }, { status: 400 });
  }
  if (!body.prompt || typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }
  if (body.modelType !== 'image' && body.modelType !== 'language') {
    return NextResponse.json({ error: 'modelType must be "image" or "language"' }, { status: 400 });
  }
  const started = Date.now();
  const generationId = randomUUID();

  console.log(`\n${TAG} ═══════════════════════════════════════`);
  console.log(`${TAG} IMAGE GENERATION REQUEST`);
  console.log(`${TAG}   user=${accountName} (${accountId.slice(0, 8)})`);
  console.log(`${TAG}   model=${body.model} type=${body.modelType}`);
  console.log(`${TAG}   prompt="${body.prompt.slice(0, 80)}${body.prompt.length > 80 ? '...' : ''}"`);
  console.log(`${TAG}   aspect=${body.aspectRatio ?? '1:1'} n=${body.n ?? 1}`);
  console.log(`${TAG}   gen=${generationId.slice(0, 8)}`);
  console.log(`${TAG} ═══════════════════════════════════════`);

  // ─── Billing hold ───
  const holdResult = createGenerationHold({
    accountId,
    model: body.model,
    modelType: body.modelType,
    operation: body.modelType === 'image' ? 'generateImage' : 'generateText',
    generationId,
  });

  if (!holdResult.ok) {
    console.log(`${TAG} ✗ REJECTED — insufficient funds: available=$${holdResult.available} required=$${holdResult.required}`);
    return NextResponse.json(
      { error: 'insufficient_funds', available: holdResult.available, required: holdResult.required },
      { status: 402 }
    );
  }

  const holdTxId = holdResult.holdTx.id;
  console.log(`${TAG} ✓ Hold created, starting AI call...`);

  try {
    if (body.modelType === 'image') {
      const aspect = body.aspectRatio ?? '1:1';
      const dims = ASPECT_DIMENSIONS[aspect] ?? ASPECT_DIMENSIONS['1:1'];

      console.log(`${TAG}   Path: experimental_generateImage (pure image)`);
      console.log(`${TAG}   Dimensions: ${dims.width}x${dims.height} (${aspect})`);

      const result = await generateImage({
        model: gateway.imageModel(body.model),
        prompt: body.prompt,
        aspectRatio: aspect,
        size: `${dims.width}x${dims.height}`,
        n: body.n ?? 1,
        providerOptions: {
          bfl: { width: dims.width, height: dims.height },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gw = (result.providerMetadata?.gateway as any) ?? {};
      const gatewayCost = gw.cost != null ? Number(gw.cost) : undefined;
      const provider = extractProvider(gw);

      console.log(`${TAG} ✓ IMAGE COMPLETE — latency=${Date.now() - started}ms`);
      console.log(`${TAG}   images=${result.images.length} cost=${gatewayCost != null ? `$${gatewayCost.toFixed(6)}` : 'MISSING'} provider=${provider}`);

      settleGeneration({
        holdTxId,
        actualCost: gatewayCost,
        generationId,
        metadata: { model: body.model, operation: 'generateImage' },
      });

      try {
        logUsage({
          generation_id: gw.generationId ?? generationId,
          model_id: body.model,
          model_type: 'image',
          operation: 'generateImage',
          prompt_preview: body.prompt.slice(0, 200),
          image_count: result.images.length,
          latency_ms: Date.now() - started,
          cost_usd: gatewayCost ?? 0,
          market_cost_usd: gw.marketCost ? Number(gw.marketCost) : undefined,
          provider_used: provider,
          raw_metadata: result.providerMetadata,
        });
      } catch (logErr) {
        console.error(`${TAG} ⚠ logUsage failed (billing unaffected): ${logErr}`);
      }

      return NextResponse.json({
        kind: 'image-only',
        generationId,
        images: result.images.map((img) => ({
          base64: img.base64,
          mediaType: img.mediaType ?? 'image/png',
        })),
      });
    }

    // Multimodal
    console.log(`${TAG}   Path: generateText (multimodal)`);
    const result = await generateText({
      model: gateway(body.model),
      prompt: body.prompt,
    });

    const imageFiles = (result.files ?? []).filter((f) =>
      f.mediaType?.startsWith('image/')
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gw = (result.providerMetadata?.gateway as any) ?? {};
    const gatewayCost = gw.cost != null ? Number(gw.cost) : undefined;
    const provider = extractProvider(gw);

    console.log(`${TAG} ✓ MULTIMODAL COMPLETE — latency=${Date.now() - started}ms`);
    console.log(`${TAG}   images=${imageFiles.length} tokens_in=${result.usage.inputTokens} tokens_out=${result.usage.outputTokens}`);
    console.log(`${TAG}   cost=${gatewayCost != null ? `$${gatewayCost.toFixed(6)}` : 'MISSING'} provider=${provider}`);

    settleGeneration({
      holdTxId,
      actualCost: gatewayCost,
      generationId,
      metadata: { model: body.model, operation: 'generateText' },
    });

    try {
      logUsage({
        generation_id: gw.generationId ?? generationId,
        model_id: body.model,
        model_type: 'language',
        operation: 'generateText',
        prompt_preview: body.prompt.slice(0, 200),
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        cached_input_tokens: result.usage.cachedInputTokens,
        reasoning_tokens: result.usage.reasoningTokens,
        image_count: imageFiles.length,
        latency_ms: Date.now() - started,
        cost_usd: gatewayCost ?? 0,
        market_cost_usd: gw.marketCost ? Number(gw.marketCost) : undefined,
        provider_used: provider,
        raw_metadata: result.providerMetadata,
      });
    } catch (logErr) {
      console.error(`${TAG} ⚠ logUsage failed (billing unaffected): ${logErr}`);
    }

    return NextResponse.json({
      kind: 'multimodal',
      generationId,
      text: result.text,
      images: imageFiles.map((f) => ({
        base64: Buffer.from(f.uint8Array).toString('base64'),
        mediaType: f.mediaType,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.log(`${TAG} ✗ GENERATION ERROR: ${message}`);

    releaseHold({ holdTxId, reason: message });

    try {
      logUsage({
        model_id: body.model,
        model_type: body.modelType,
        operation: body.modelType === 'image' ? 'generateImage' : 'generateText',
        prompt_preview: body.prompt.slice(0, 200),
        latency_ms: Date.now() - started,
        status: 'error',
        error_message: message,
      });
    } catch { /* swallow */ }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
