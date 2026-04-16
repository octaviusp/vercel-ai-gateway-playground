<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Vercel AI Gateway Playground

## Overview

Internal playground for testing 264+ AI models via Vercel AI Gateway with a full credit-based billing system. Single-page dashboard with text/image generation, real-time cost tracking, and a transaction ledger.

**Stack:** Next.js 16, AI SDK v6, `@ai-sdk/gateway`, Tailwind v4, shadcn/ui (base-nova), TypeScript

## Architecture

```
User -> AuthGate -> PlaygroundProvider (React Context)
  |
  |-> Select model (264+ from gateway API)
  |-> Write prompt -> Generate
  |
  |-> Hold (pre-auth, pending) -> AI Gateway call -> Settle (actual cost) or Release (error)
  |
  |-> Transaction Ledger <- Balance Update <- UI Refresh (5s poll)
```

All state is **in-memory** (Maps). No database. Data resets on server restart.

## File Map

### Core Billing (`src/lib/`)

| File | What it does |
|------|-------------|
| `ledger.ts` | **Append-only transaction store.** Types: topup/hold/charge/release/refund. States: pending→voided (holds only), settled (everything else). Balance computed via `getBalance()` and `getAvailableBalance()`. Includes hold expiration sweep (5min TTL). |
| `billing-flow.ts` | **Hold/settle/release orchestrator.** `createGenerationHold()` estimates cost + checks balance. `settleGeneration()` voids hold + creates charge with real gateway cost. `releaseHold()` voids hold on error. |
| `cost-estimator.ts` | **Pre-auth hold estimation.** Fetches pricing from gateway `/v1/models` on startup (cached). Calculates hold = estimated cost × 1.5 safety buffer. Falls back to probed/fallback prices. |
| `accounts.ts` | **User account store.** In-memory Map. Pre-seeds 3 demo users with $5 each. `createAccount()`, `getAccountByEmail()`. |
| `auth.ts` | **Session management.** Cookie-based (`artyx_session`). `createSession()`, `requireAuth()`, `getSessionFromRequest()`. HttpOnly + SameSite + Secure (prod). |
| `pricing.ts` | **Verified pricing for all models.** IMAGE_PRICING (per-image costs), PROBED_LANGUAGE_PRICING (free/per-request). Data from gateway API + real probe script. |
| `billing.ts` | **Legacy usage telemetry.** Simple UsageRow array for raw gateway data (tokens, latency, provider). Runs alongside the credit ledger. |
| `gateway.ts` | **AI SDK gateway instance.** `createGateway()` with API key from env. |
| `models.ts` | **GatewayModel type + static fallback.** 26 models as fallback if `/v1/models` is unreachable. |
| `playground-context.tsx` | **React Context.** All shared state: auth, account, models, generation, timer, billing. Actions: `runGeneration()`, `topup()`, `login()`, `register()`. |

### API Routes (`src/app/api/`)

| Route | Method | What it does |
|-------|--------|-------------|
| `/api/auth/register` | POST | Create account (email + name) → session cookie |
| `/api/auth/login` | POST | Login by email → session cookie |
| `/api/auth/me` | GET | Return current user from session or 401 |
| `/api/account` | GET | Balance + available balance + pending holds |
| `/api/account/topup` | POST | Add credits (max $100/tx, $1000 cap) |
| `/api/account/transactions` | GET | Transaction history with filters |
| `/api/chat` | POST | **Text generation.** Auth → hold → streamText → settle/release. Input validation. Stream safety-net. |
| `/api/image` | POST | **Image generation.** Auth → hold → generateImage or generateText (multimodal) → settle/release. |
| `/api/models` | GET | 264+ models from gateway (cached 5min, static fallback) |
| `/api/usage` | GET | Raw usage telemetry + aggregates |
| `/api/usage/export` | GET | Markdown billing report download |

### UI Components (`src/app/playground/components/`)

| Component | What it does |
|-----------|-------------|
| `AuthGate.tsx` | Login/register screen. Quick-login buttons for demo users. Wraps playground. |
| `ModelSelectorCompact.tsx` | Dialog-based model picker. Grouped by provider. Shows pricing. Auto-detects text/image mode. |
| `PromptArea.tsx` | Prompt textarea + collapsible system prompt + aspect ratio selector (image mode). Cmd+Enter shortcut. |
| `GenerateButton.tsx` | Generate button + live elapsed timer (RAF-driven). Shows cost estimate + available balance. Disabled on insufficient funds. |
| `OutputArea.tsx` | Streaming text with blinking cursor OR image grid. Metadata footer (model, provider, tokens, cost). |
| `SessionStatsBar.tsx` | Top bar: session spent, requests, avg latency, tokens, wallet balance. |
| `AccountSummary.tsx` | Sidebar: user info, balance (color-coded), topup button. |
| `TopupDialog.tsx` | Credit topup modal. Preset amounts ($1/$5/$10/$25) + custom. |
| `TransactionFeed.tsx` | Transaction ledger feed. Type badges (colored), status dots, amounts to 6 decimals. Voided holds dimmed. |

### Hooks (`src/hooks/`)

| Hook | What it does |
|------|-------------|
| `use-auth.ts` | Client auth state. Checks `/api/auth/me` on mount. `login()`, `register()`, `logout()`. |
| `use-account.ts` | Balance + transaction polling (5s). 401 detection → auto-logout. `topup()` action. |
| `use-elapsed-timer.ts` | `requestAnimationFrame` timer. Returns live `elapsedMs` while running. |
| `use-billing-poll.ts` | Polls `/api/usage` for raw telemetry. Detects new entries for animation. |

### Scripts (`scripts/`)

| File | What it does |
|------|-------------|
| `probe-pricing.ts` | Calls every model without API pricing to capture real `gateway.cost`. Outputs pricing-map.json + report. Run with `npx tsx scripts/probe-pricing.ts`. |

## Key Design Decisions

- **Balance is NEVER stored** — always `SUM(amount) WHERE settled`. Available = settled + pending.
- **Hold amount** = estimated cost × 1.5. Actual charge uses real `providerMetadata.gateway.cost`.
- **Void is idempotent** — calling `voidTransaction()` on an already-voided hold returns silently.
- **NaN guard** — `Number.isFinite()` at ledger entry point. One NaN would corrupt all balances permanently.
- **Stream safety-net** — `Promise.resolve(result.usage)` catches stream failures that bypass `onFinish`.
- **Hold expiration** — 60s sweep voids holds older than 5 minutes (prevents permanently locked funds).

## Commands

```bash
pnpm dev          # Dev server with Turbopack
pnpm build        # Production build
pnpm lint         # ESLint
npx tsc --noEmit  # Type check
npx tsx scripts/probe-pricing.ts  # Re-probe model pricing
```

## Environment

```bash
# Required — one key unlocks 264 models
AI_GATEWAY_API_KEY=vck_your_key_here
```
