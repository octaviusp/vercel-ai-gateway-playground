import { NextResponse } from 'next/server';
import { STATIC_MODEL_FALLBACK, type GatewayModel } from '@/lib/models';

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const res = await fetch('https://ai-gateway.vercel.sh/v1/models', {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
    const json = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const models: GatewayModel[] = (json.data ?? []).map((m: any) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      type: m.type,
      context_window: m.context_window,
      max_tokens: m.max_tokens,
      tags: m.tags,
      pricing: m.pricing,
      owned_by: m.owned_by,
    }));

    return NextResponse.json({ models, source: 'gateway' });
  } catch (err) {
    console.warn('[api/models] Falling back to static catalog:', err);
    return NextResponse.json({
      models: STATIC_MODEL_FALLBACK,
      source: 'fallback',
    });
  }
}
