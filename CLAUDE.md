# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**TraderNews** — an AI-enriched Forex Factory–style economic calendar for active US day traders. Built on a $0 budget (free tiers only). The solo founder is a Hebrew-speaking day trader who validates trading concepts naturally; explain trading-domain things at expert level, but explain web-dev/infrastructure things at intro level. Respond in Hebrew when the user writes Hebrew.

**Approved plan (source of truth)**: `C:\Users\Inbar\.claude\plans\glimmering-zooming-salamander.md`
**Project memory**: `C:\Users\Inbar\.claude\projects\c--Users-Inbar-OneDrive-Desktop-New-folder\memory\` — read MEMORY.md first, includes user profile + free-only constraint + unit-display rules.

## Working style (from prior session, still apply)

- Act directly. Don't pre-narrate ("let me check...") or post-summarize unless asked.
- Minimal diffs. Never rewrite a whole file to change a few lines.
- Don't read files outside the task scope.
- Don't add comments to code unless the task asks for documentation.
- Plan first for non-trivial tasks (use the plan workflow); minimal verbosity for routine edits.
- After a user correction, save the lesson to project memory so it survives future sessions.

## Commands

```bash
npm install                        # workspaces: apps/web + workers
npm run dev                        # Next.js dev server → http://localhost:3000/calendar
npm run build                      # production build of apps/web
npm run typecheck                  # tsc --noEmit across web + workers
npm run worker:pull-calendar       # pulls FairEconomy JSON → Supabase events table
```

Workers individually (from repo root): `npm --workspace workers run <script>`.

**No test suite yet** — verification is by hitting the dev server and inspecting Supabase rows. When v0.2 adds the reaction engine, plan to add Vitest for `reaction-engine.ts` pure functions.

**Migrations** are applied by pasting `supabase/migrations/*.sql` into the Supabase Dashboard SQL Editor. They are idempotent (`if not exists` / `on conflict do nothing`), safe to re-run. There is no Supabase CLI integration set up.

## Architecture — the big picture

**Monorepo with three independent runtimes that share only the Supabase DB:**

```
apps/web/        Next.js 15 App Router (RSC + ISR) on Vercel.   READS from Supabase.
workers/         Node 20 cron scripts on GitHub Actions.        WRITES to Supabase.
supabase/        SQL migrations + Edge Function stubs.          The shared substrate.
```

The web app and workers **never talk to each other directly**. All coordination is through Postgres rows. This matters because: (a) Vercel free tier can't run hourly cron (1/day cap), so workers must be elsewhere; (b) the public GitHub repo gets unlimited Actions minutes — **the repo must stay public**.

**Data flow**:
```
FairEconomy JSON  ──┐
yahoo-finance2    ──┼──► workers (GH Actions cron) ──► Supabase Postgres ──► Next.js RSC (ISR 300s)
Gemini API        ──┘                                                              │
                                                                                   ▼
                                                                              browser
```

**Web app fallback pattern** ([apps/web/app/calendar/page.tsx](apps/web/app/calendar/page.tsx)): if `NEXT_PUBLIC_SUPABASE_URL` is unset, `getSupabaseServer()` returns `null` and the page renders [`MOCK_EVENTS`](apps/web/lib/mock-events.ts) instead, with an amber "Showing mock data" banner. This means new contributors can run `npm run dev` with zero config and see a working calendar. Don't remove this fallback.

**The reaction engine is source-agnostic** ([apps/web/lib/reaction-engine.ts](apps/web/lib/reaction-engine.ts) — to be written in v0.2): it reads from `price_bars_1m` regardless of who filled the table. yfinance, HistData, Alpaca, Databento all dump into the same table. This is why backfill is a one-time op (seed scripts run on local laptop, not Actions) and forward capture is automated.

**Unit handling rule**: per-instrument display unit is driven by `symbols.unit_label` (`'percent'` | `'pips'` | `'points'`). UI components like ReactionStats read this column to pick column order. **No per-symbol if/else in JSX.** ETFs default to percent, FX to pips, futures to points — but the schema stores all three for every symbol, so swapping the default doesn't require recomputing reactions. See the units memory in the project memory dir.

**AI enrichment cache**: every Gemini call is keyed by `(event_id, kind, prompt_hash)` in `ai_enrichments` with a TTL (`expires_at`). Workers check expiry before calling Gemini — a re-run of `enrich-upcoming` within 14 days is a no-op. This is essential to staying under the 1000 RPD free-tier limit.

## Free-tier constraints that shape decisions

These are the project's spine — verify before suggesting any architecture change:

| Constraint | Implication |
|---|---|
| Gemini 1000 RPD / 15 RPM | Workers must `await sleep(4500)` between AI calls; aggressive cache TTLs |
| Supabase 500 MB | `price_bars_1m` is pruned to ±2h windows around event timestamps |
| Vercel Hobby cron = 1/day | All scheduled work runs on GitHub Actions instead |
| GitHub Actions free = public repo only | Repo MUST stay public |
| yfinance 1-min bars = last 30 days | "Opportunistic capture" — fetch & store while we still can; deep-history seeded once from HistData/Alpaca/Databento |
| FairEconomy unofficial | Single point of failure — pull twice/week max to avoid IP bans |

**Hard rules (per project memory, do not violate without asking the user):**
- No paid APIs, no OpenAI/Anthropic SDKs — Gemini only.
- No paid SaaS, no mandatory subscriptions.
- One-time free credits (e.g., Databento $125) are OK for one-shot backfills only, not recurring usage.

## Schema choices worth knowing before editing

- `events.unique(source, source_ref)` — dedupe key. `pull-calendar` upserts on this. `source_ref` is `ff:{currency}:{iso_release_at}:{slug-title}` ([workers/lib/faireconomy.ts](workers/lib/faireconomy.ts)).
- `event_occurrences` is split from `events` so we can update actuals late without touching the immutable scheduled-release row.
- `historical_reactions` has both `*_pct_*` and `*_pts_*` columns for every time bucket — populated together by the reaction engine.
- All public read tables have explicit `for select using (true)` RLS policies; user-scoped tables (`profiles`, `watchlists`) require `auth.uid()`.

## When in doubt

- Free or paid? Check [project memory: feedback_free_only](file:///C:/Users/Inbar/.claude/projects/c--Users-Inbar-OneDrive-Desktop-New-folder/memory/feedback_free_only.md).
- Which AI provider? [feedback_ai_gemini](file:///C:/Users/Inbar/.claude/projects/c--Users-Inbar-OneDrive-Desktop-New-folder/memory/feedback_ai_gemini.md).
- Which unit to display? [feedback_units](file:///C:/Users/Inbar/.claude/projects/c--Users-Inbar-OneDrive-Desktop-New-folder/memory/feedback_units.md).
- New external data source candidate? [reference_free_data_sources](file:///C:/Users/Inbar/.claude/projects/c--Users-Inbar-OneDrive-Desktop-New-folder/memory/reference_free_data_sources.md).
- Scope or roadmap question? The approved plan file linked at top.
