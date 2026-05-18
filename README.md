# TraderNews

AI-enriched economic calendar for active US day traders. Forex Factory–style table, plus per-event AI explainer, historical price-reaction stats (avg pts/% move at T+1m/5m/15m/60m), and a 1–10 volatility-rest-of-morning score. Built on a $0 budget.

## Status

**v0.1** — calendar page + FairEconomy pull worker (this is what's shipped).
See [the approved plan](C:\Users\Inbar\.claude\plans\glimmering-zooming-salamander.md) for full roadmap.

## Stack

- **Next.js 15** (App Router, TypeScript) on **Vercel**
- **Supabase** Postgres + Auth + Edge Functions
- **GitHub Actions** for cron workers — **repo must be public** for unlimited free minutes
- **Gemini 2.5 Flash-Lite** for AI enrichment (free tier, v1+)
- **yahoo-finance2** for market data
- **Tailwind CSS v4** + shadcn-style primitives, dark mode

## Quickstart

```bash
# Install deps (root + workspaces)
npm install

# Copy env template and fill in Supabase keys
cp .env.example .env.local

# Run the calendar page (uses mock data if Supabase not configured)
npm run dev
# → http://localhost:3000/calendar

# Pull this week's economic calendar from FairEconomy into Supabase
npm run worker:pull-calendar
```

## Repo layout

```
apps/web/                 Next.js app
  app/calendar/           the calendar page
  app/event/[slug]/       per-event detail page
  lib/                    Supabase clients, types, formatters
workers/                  cron scripts (Node 20)
  pull-calendar.ts        FairEconomy JSON → Supabase events
  data/                   seed data (event_types, symbols)
supabase/migrations/      SQL schema
.github/workflows/        cron schedules (one per worker)
```

## Setup checklist

1. Create a free Supabase project at https://supabase.com
2. Run the migration: `supabase/migrations/0001_init.sql` in the Supabase SQL editor
3. Copy URL + anon key + service-role key into `.env.local`
4. Push this repo to GitHub as **public**
5. Add `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` as repo secrets (Settings → Secrets and variables → Actions)
6. Deploy to Vercel: import the repo, add the same env vars

## License

Private / unlicensed for now.
