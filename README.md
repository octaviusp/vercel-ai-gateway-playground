# Vercel AI Gateway Playground

A production-grade internal tool for testing **264+ AI models** through [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) with real-time **credit-based billing**, a full **transaction ledger**, and per-request cost tracking down to $0.000001.

Built with Next.js 16, AI SDK v6, and shadcn/ui. No external billing provider needed — the entire credit system runs in-memory with industry-standard patterns (hold/charge/void lifecycle, idempotency, overdraft protection).

<img width="800" height="400" alt="image" src="https://github.com/user-attachments/assets/d8db5643-52d3-4d3b-bad7-16a4f50db8f6" />


## What It Does

- **264+ models** from OpenAI, Anthropic, Google, Meta, Mistral, xAI, BFL, Recraft, and more — auto-discovered from the gateway
- **Text generation** with streaming, real-time timer, and token tracking
- **Image generation** with FLUX, Imagen, Recraft, Seedream — dual path (pure image + multimodal)
- **Credit-based billing** with pre-auth holds, actual cost settlement, and automatic hold expiration
- **Transaction ledger** showing every topup, hold, charge, and void with full audit trail
- **Per-model pricing** — 249 models from API + 15 probed via real gateway calls for verified costs
- **Session stats** — running totals for cost, requests, latency, and tokens

## Quick Start

```bash
# Clone
git clone https://github.com/octaviusp/vercel-ai-gateway-playground.git
cd vercel-ai-gateway-playground

# Install
pnpm install

# Configure
cp .env.example .env.local
# Edit .env.local and paste your Vercel AI Gateway API key

# Run
pnpm dev
```

Open `http://localhost:3000` — login as one of the pre-seeded test users (Admin, User One, or User Two — each starts with $5.00 credits).

## Getting Your API Key

1. Go to [Vercel Dashboard](https://vercel.com) -> your team -> **AI Gateway** tab
2. Click **API Keys** -> **Create Key**
3. Copy the key (starts with `vck_`)
4. Paste it in `.env.local` as `AI_GATEWAY_API_KEY`

That's it. One key, 264 models.

## Architecture

```
User -> AuthGate (login) -> PlaygroundProvider (React Context)
  |
Select Model -> Write Prompt -> Generate
  |
Hold (pre-auth) -> AI Gateway -> Settle (actual cost) or Release (on error)
  |
Transaction Ledger <- Balance Update <- UI Refresh
```

### Credit Billing Flow

Every generation follows a **hold -> charge -> void** lifecycle:

1. **HOLD** — Estimated cost reserved from available balance (pending)
2. **AI CALL** — Request sent to Vercel AI Gateway
3. **SETTLE** — Hold voided + actual charge created (from `providerMetadata.gateway.cost`)
4. **or RELEASE** — Hold voided on error, funds returned

Balance is **never stored** — always computed from the sum of settled transactions. Available balance subtracts pending holds. This is the same pattern Stripe uses for authorization/capture.

### Safety Features

- **NaN/Infinity guard** — prevents ledger corruption from malformed gateway responses
- **Idempotency keys** — prevents double-charging on retries
- **Hold expiration** — 5-minute TTL with 60-second sweep prevents permanently locked funds
- **Overdraft warning** — charges actual cost even if it exceeds the hold estimate
- **Pre-validation** — validates charge amount before voiding the hold (atomicity)
- **Stream safety net** — releases holds if `onFinish` never fires on stream timeout
- **Rapid-click lock** — synchronous ref prevents double-fire within same render cycle

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| AI SDK | `ai` v6 + `@ai-sdk/gateway` |
| UI | Tailwind CSS v4 + shadcn/ui (base-nova) |
| State | React Context + custom hooks |
| Auth | Cookie-based sessions (mocked, in-memory) |
| Billing | Append-only transaction ledger (in-memory) |
| Pricing | Gateway API + probed costs for 264 models |

## Project Structure

```
src/
  app/
    api/
      auth/          # register, login, me
      account/       # balance, topup, transactions
      chat/          # POST - streamText with billing
      image/         # POST - generateImage with billing
      models/        # GET - 264 models from gateway
      usage/         # GET - telemetry + markdown export
    playground/
      page.tsx       # Dashboard layout
      components/    # AuthGate, ModelSelector, Output, TransactionFeed...
  lib/
    ledger.ts          # Append-only transaction store + state machine
    billing-flow.ts    # Hold/settle/release orchestrator
    cost-estimator.ts  # Per-model hold estimation with pricing cache
    accounts.ts        # User accounts (in-memory)
    auth.ts            # Session management
    pricing.ts         # Verified pricing for 264 models
    gateway.ts         # AI SDK gateway provider
    billing.ts         # Raw usage telemetry store
  hooks/
    use-auth.ts        # Client auth state
    use-account.ts     # Balance polling + 401 detection
    use-elapsed-timer.ts  # RAF-driven generation timer
    use-billing-poll.ts   # Usage feed polling
```

## Notes

- **In-memory storage** — all data resets on server restart. This is intentional for an experimenter tool.
- **No real auth** — login is email-only (no password). Pre-seeded test users for quick access.
- **Topup is free** — no payment integration. Credits are simulated USD for cost tracking.
- **Gateway cost is authoritative** — the `providerMetadata.gateway.cost` from Vercel is the source of truth for billing, not our estimates.

## License

MIT
