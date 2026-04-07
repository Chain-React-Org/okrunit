# OKRunit

Human-in-the-loop approval gateway for AI agents and automations.

**Production:** [okrunit.com](https://okrunit.com)

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth + WebAuthn passkeys + SAML SSO
- **UI:** shadcn/ui + Tailwind CSS 4
- **Payments:** Stripe
- **Email:** Resend
- **Hosting:** Vercel

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (or npm)
- Vercel CLI (`npm i -g vercel`)

### Setup

```bash
# Install dependencies
pnpm install

# Pull environment variables from Vercel
vercel env pull

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database Migrations

When creating a new migration in `supabase/migrations/`, push it immediately:

```bash
supabase db push --include-all
```

Never leave unpushed migrations. Code that depends on the new schema will break in production.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:watch` | Unit tests in watch mode |
| `pnpm test:e2e` | End-to-end tests (Playwright) |
| `pnpm test:e2e:ui` | E2E tests with Playwright UI |

## Git Workflow

**Never push directly to `main`.** It is protected.

1. Commit to `dev`
2. `git push origin dev`
3. A GitHub Action auto-creates a PR from `dev` → `main` with auto-merge
4. CI runs (lint, typecheck, tests, build)
5. If CI passes, the PR squash-merges to `main`

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (dashboard)/        # Authenticated dashboard pages
│   ├── (marketing)/        # Public marketing pages
│   └── api/                # API routes (v1)
├── components/             # React components
│   ├── ui/                 # shadcn/ui primitives
│   ├── analytics/          # Analytics dashboard
│   ├── billing/            # Stripe billing UI
│   ├── landing/            # Landing page sections
│   └── playground/         # API playground / request builder
├── hooks/                  # Custom React hooks
└── lib/                    # Server-side logic
    ├── api/                # API helpers (auth, validation, callbacks, rules)
    ├── billing/            # Stripe integration and plan enforcement
    ├── cache/              # Cached queries
    ├── monitoring/         # Error capture and grouping
    └── notifications/      # Email templates and channel orchestration

supabase/
└── migrations/             # Database migrations

integrations/               # Platform-specific integration packages
├── github-actions/         # GitHub Action (TypeScript)
├── temporal/               # Temporal workflows (Python)
├── dagster/                # Dagster resource + ops (Python)
├── windmill/               # Windmill scripts
├── pipedream/              # Pipedream components
└── prefect/                # Prefect tasks + flows (Python)

packages/
├── sdk-typescript/         # @okrunit/sdk - TypeScript SDK
└── cli/                    # okrunit CLI tool

sdks/
├── python/                 # Python SDK
└── go/                     # Go SDK
```

## Key Environment Variables

All env vars are managed through Vercel. Run `vercel env pull` to sync locally.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-side only) |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `RESEND_API_KEY` | Email sending |
| `SLACK_CLIENT_ID/SECRET` | Slack OAuth integration |
| `DISCORD_CLIENT_ID/SECRET` | Discord bot integration |
| `TEAMS_CLIENT_ID/SECRET` | Microsoft Teams integration |
| `TELEGRAM_BOT_TOKEN` | Telegram bot |
| `CALLBACK_HMAC_SECRET` | Webhook callback signing |
