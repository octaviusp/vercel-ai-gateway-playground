# CLAUDE.md

@AGENTS.md

## Quick Navigation

| Looking for... | Go to |
|----------------|-------|
| Transaction ledger logic | `src/lib/ledger.ts` |
| Hold/settle/release flow | `src/lib/billing-flow.ts` |
| Cost estimation for holds | `src/lib/cost-estimator.ts` |
| Model pricing data | `src/lib/pricing.ts` |
| Gateway provider setup | `src/lib/gateway.ts` |
| Auth + sessions | `src/lib/auth.ts` |
| Account store + seeding | `src/lib/accounts.ts` |
| All shared React state | `src/lib/playground-context.tsx` |
| Text generation route | `src/app/api/chat/route.ts` |
| Image generation route | `src/app/api/image/route.ts` |
| Main page layout | `src/app/playground/page.tsx` |
| Login/register UI | `src/app/playground/components/AuthGate.tsx` |
| Model picker UI | `src/app/playground/components/ModelSelectorCompact.tsx` |
| Transaction feed UI | `src/app/playground/components/TransactionFeed.tsx` |

## Pre-Commit

```bash
npx tsc --noEmit && pnpm build
```

## Important

- All billing state is in-memory — server restart clears everything
- The gateway `providerMetadata.gateway.cost` is the billing source of truth
- Hold amounts are estimates (1.5x buffer) — charges use the real cost
- `tokens: in=undefined` is normal for some models — cost is still captured correctly
