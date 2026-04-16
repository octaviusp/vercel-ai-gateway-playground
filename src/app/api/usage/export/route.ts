import { NextResponse } from 'next/server';
import { getAllUsage } from '@/lib/billing';

export async function GET() {
  const rows = getAllUsage(500);

  const totalCost = rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const totalReqs = rows.length;
  const byModel = rows.reduce<Record<string, { count: number; cost: number }>>(
    (acc, r) => {
      const k = r.model_id;
      acc[k] = acc[k] ?? { count: 0, cost: 0 };
      acc[k].count += 1;
      acc[k].cost += Number(r.cost_usd ?? 0);
      return acc;
    },
    {}
  );

  const md = [
    `# Artyx — AI Gateway Billing Report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Summary`,
    ``,
    `- **Total requests:** ${totalReqs}`,
    `- **Total cost:** $${totalCost.toFixed(6)}`,
    `- **Avg cost per request:** $${(totalCost / (totalReqs || 1)).toFixed(6)}`,
    ``,
    `## Spend by model`,
    ``,
    `| Model | Requests | Total Cost | Avg/Req |`,
    `|---|---:|---:|---:|`,
    ...Object.entries(byModel)
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(
        ([m, s]) =>
          `| \`${m}\` | ${s.count} | $${s.cost.toFixed(6)} | $${(s.cost / s.count).toFixed(6)} |`
      ),
    ``,
    `## Operation log (last 500)`,
    ``,
    `| Timestamp | Model | Op | Tokens (in/out) | Images | Latency | Cost |`,
    `|---|---|---|---|---:|---:|---:|`,
    ...rows.map(
      (r) =>
        `| ${r.created_at} | \`${r.model_id}\` | ${r.operation} | ${r.input_tokens ?? '-'} / ${r.output_tokens ?? '-'} | ${r.image_count ?? 0} | ${r.latency_ms ?? '-'}ms | $${Number(r.cost_usd ?? 0).toFixed(6)} |`
    ),
  ].join('\n');

  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="artyx-ai-usage-${Date.now()}.md"`,
    },
  });
}
