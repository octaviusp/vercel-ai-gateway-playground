import { NextRequest, NextResponse } from 'next/server';
import { getUsage } from '@/lib/billing';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get('limit') ?? 50);
  const model = searchParams.get('model') ?? undefined;

  const rows = getUsage({ limit, model });

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalCost += Number(row.cost_usd ?? 0);
      acc.totalMarketCost += Number(row.market_cost_usd ?? 0);
      acc.totalInputTokens += row.input_tokens ?? 0;
      acc.totalOutputTokens += row.output_tokens ?? 0;
      acc.totalImages += row.image_count ?? 0;
      acc.totalRequests += 1;
      acc.totalErrors += row.status === 'error' ? 1 : 0;
      return acc;
    },
    {
      totalCost: 0,
      totalMarketCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalImages: 0,
      totalRequests: 0,
      totalErrors: 0,
    }
  );

  return NextResponse.json({ rows, totals });
}
