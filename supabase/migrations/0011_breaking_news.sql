-- Breaking news headlines pulled from 5 free sources (Fed, ECB, BLS, Reuters, Yahoo).
-- Two-stage AI pipeline:
--   1. E.6 classifier — cheap Gemini call, scores impact 1-10 on EVERY new headline
--   2. E.2 verifier   — Gemini with Google Search grounding, ONLY for impact_score >= 5
-- Realtime subscription on this table powers the /breaking page.

create table if not exists breaking_headlines (
  id              uuid primary key default gen_random_uuid(),
  source_id       text unique not null,            -- "yahoo:<uuid>" / "fed:<guid>" / "reuters:<hash>" / ...
  source_name     text not null check (source_name in ('fed','ecb','wsj','yahoo')),
  headline        text not null,
  source_url      text,
  published_at    timestamptz not null,
  discovered_at   timestamptz not null default now(),

  -- E.6 classifier output
  impact_score    int,                              -- 1..10
  category        text check (category in ('fed','macro','geo','corp','noise')),
  classifier_reason text,
  classified_at   timestamptz,

  -- E.2 verifier output (only for impact_score >= 5)
  summary             text,
  market_implication  text,
  affected_symbols    text[],
  ai_confidence       text check (ai_confidence in ('high','medium','low')),
  ai_verified         boolean,
  ai_enriched         boolean not null default false,
  ai_enriched_at      timestamptz
);

create index if not exists breaking_published_idx
  on breaking_headlines (published_at desc);

create index if not exists breaking_impact_idx
  on breaking_headlines (impact_score desc nulls last, published_at desc);

create index if not exists breaking_category_idx
  on breaking_headlines (category)
  where category is not null;

-- Public read so the /breaking page can SSR + Realtime subscribe without auth
alter table breaking_headlines enable row level security;
drop policy if exists "breaking_headlines_public_read" on breaking_headlines;
create policy "breaking_headlines_public_read"
  on breaking_headlines for select using (true);
