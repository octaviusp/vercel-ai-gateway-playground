import { streamText } from 'ai';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { gateway } from '@/lib/gateway';
import { logUsage } from '@/lib/billing';
import { requireAuth, AuthError } from '@/lib/auth';
import { createGenerationHold, settleGeneration, releaseHold } from '@/lib/billing-flow';
import { ensureSeeded } from '@/lib/accounts';

export const maxDuration = 60;

const TAG = '\x1b[95m[API/CHAT]\x1b[0m';

/** Extract provider from gateway routing metadata */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractProvider(gw: any): string {
  return gw?.routing?.finalProvider ?? gw?.routing?.resolvedProvider ?? gw?.provider ?? gw?.providerName ?? 'unknown';
}

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

  let body: { model?: string; prompt?: string; system?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { model, prompt, system } = body;
  if (!model || typeof model !== 'string') {
    return NextResponse.json({ error: 'model is required' }, { status: 400 });
  }
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }
  const started = Date.now();
  const generationId = randomUUID();

  console.log(`\n${TAG} ═══════════════════════════════════════`);
  console.log(`${TAG} TEXT GENERATION REQUEST`);
  console.log(`${TAG}   user=${accountName} (${accountId.slice(0, 8)})`);
  console.log(`${TAG}   model=${model}`);
  console.log(`${TAG}   prompt="${prompt?.slice(0, 80)}${prompt?.length > 80 ? '...' : ''}"`);
  console.log(`${TAG}   gen=${generationId.slice(0, 8)}`);
  console.log(`${TAG} ═══════════════════════════════════════`);

  // ─── Billing hold ───
  const holdResult = createGenerationHold({
    accountId,
    model,
    modelType: 'language',
    operation: 'streamText',
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

  // ─── Generate ───
  try {
    const result = streamText({
      model: gateway(model),
      system,
      prompt,
      onFinish: async ({ usage, providerMetadata }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gw = (providerMetadata?.gateway as any) ?? {};
        const gatewayCost = gw.cost != null ? Number(gw.cost) : undefined;
        const provider = extractProvider(gw);

        console.log(`${TAG} ✓ STREAM COMPLETE — latency=${Date.now() - started}ms`);
        console.log(`${TAG}   tokens: in=${usage.inputTokens} out=${usage.outputTokens} cached=${usage.cachedInputTokens ?? 0} reasoning=${usage.reasoningTokens ?? 0}`);
        console.log(`${TAG}   gateway: cost=${gatewayCost != null ? `$${gatewayCost.toFixed(6)}` : 'MISSING'} provider=${provider}`);

        // Settle billing: void hold → create charge (falls back to estimate if cost missing)
        settleGeneration({
          holdTxId,
          actualCost: gatewayCost,
          generationId,
          metadata: { model, operation: 'streamText' },
        });

        // Log to usage store — wrapped in try/catch to not break billing
        try {
          logUsage({
            generation_id: gw.generationId ?? generationId,
            model_id: model,
            model_type: 'language',
            operation: 'streamText',
            prompt_preview: prompt?.slice(0, 200),
            input_tokens: usage.inputTokens,
            output_tokens: usage.outputTokens,
            cached_input_tokens: usage.cachedInputTokens,
            reasoning_tokens: usage.reasoningTokens,
            latency_ms: Date.now() - started,
            cost_usd: gatewayCost ?? 0,
            market_cost_usd: gw.marketCost ? Number(gw.marketCost) : undefined,
            provider_used: provider,
            raw_metadata: providerMetadata,
          });
        } catch (logErr) {
          console.error(`${TAG} ⚠ logUsage failed (billing unaffected): ${logErr}`);
        }
      },
    });

    // Safety net: if stream fails after response is sent, release the hold.
    // result.usage is PromiseLike — wrap in Promise.resolve for .catch
    Promise.resolve(result.usage).then(
      (usage) => {
        console.log(`${TAG} [safety-net] result.usage resolved: in=${usage.inputTokens} out=${usage.outputTokens}`);
      },
      (err: unknown) => {
        console.error(`${TAG} ✗ STREAM FAILED (post-response): ${err instanceof Error ? err.message : err}`);
        releaseHold({ holdTxId, reason: `stream_error: ${err instanceof Error ? err.message : 'unknown'}` });
      }
    );

    const response = result.toTextStreamResponse();
    response.headers.set('X-Generation-Id', generationId);
    return response;
  } catch (err) {
    console.log(`${TAG} ✗ GENERATION ERROR: ${err instanceof Error ? err.message : 'unknown'}`);
    releaseHold({ holdTxId, reason: err instanceof Error ? err.message : 'unknown' });

    try {
      logUsage({
        generation_id: generationId,
        model_id: model,
        model_type: 'language',
        operation: 'streamText',
        prompt_preview: prompt?.slice(0, 200),
        latency_ms: Date.now() - started,
        status: 'error',
        error_message: err instanceof Error ? err.message : 'unknown',
      });
    } catch { /* swallow */ }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
