-- TraderNews initial schema
-- Run in Supabase SQL editor or via `supabase db push`

create extension if not exists "pgcrypto";

-- ---- enums ----
do $$ begin
  create type impact_level as enum ('low','medium','high','holiday');
exception when duplicate_object then null; end $$;

do $$ begin
  create type currency_code as enum ('USD','EUR','GBP','JPY','AUD','CAD','CHF','NZD');
exception when duplicate_object then null; end $$;

-- ---- canonical event templates ----
create table if not exists event_types (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  display_name    text not null,
  currency        currency_code not null,
  country         text not null,
  category        text not null,
  default_impact  impact_level not null,
  cadence         text,
  description     text,
  created_at      timestamptz default now()
);
create index if not exists event_types_category_idx on event_types(category);

-- ---- individual scheduled releases ----
create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  event_type_id   uuid references event_types(id) on delete set null,
  title           text not null,
  release_at      timestamptz not null,
  impact          impact_level not null,
  currency        currency_code not null,
  source          text not null default 'faireconomy',
  source_ref      text,
  unique (source, source_ref)
);
create index if not exists events_release_at_idx on events (release_at desc);
create index if not exists events_impact_idx     on events (impact, release_at desc);
create index if not exists events_event_type_idx on events (event_type_id, release_at desc);

-- ---- post-release values ----
create table if not exists event_occurrences (
  event_id        uuid primary key references events(id) on delete cascade,
  actual          numeric,
  forecast        numeric,
  previous        numeric,
  revised         numeric,
  surprise_z      numeric,
  released_at     timestamptz,
  updated_at      timestamptz default now()
);

-- ---- tracked instruments ----
create table if not exists symbols (
  ticker          text primary key,
  asset_class     text not null,
  yf_symbol       text not null,
  display_name    text not null,
  tv_symbol       text not null,
  unit_label      text not null default 'percent'
                  check (unit_label in ('percent','pips','points')),
  pip_size        numeric
);

-- ---- historical reaction engine output ----
create table if not exists historical_reactions (
  id                       uuid primary key default gen_random_uuid(),
  event_type_id            uuid references event_types(id) on delete cascade,
  symbol                   text references symbols(ticker) on delete cascade,
  sample_size              int not null,
  avg_abs_pct_1m  numeric, median_abs_pct_1m  numeric, max_abs_pct_1m  numeric,
  avg_abs_pct_5m  numeric, median_abs_pct_5m  numeric, max_abs_pct_5m  numeric,
  avg_abs_pct_15m numeric, median_abs_pct_15m numeric, max_abs_pct_15m numeric,
  avg_abs_pct_60m numeric, median_abs_pct_60m numeric, max_abs_pct_60m numeric,
  avg_abs_pts_1m  numeric, median_abs_pts_1m  numeric, max_abs_pts_1m  numeric,
  avg_abs_pts_5m  numeric, median_abs_pts_5m  numeric, max_abs_pts_5m  numeric,
  avg_abs_pts_15m numeric, median_abs_pts_15m numeric, max_abs_pts_15m numeric,
  avg_abs_pts_60m numeric, median_abs_pts_60m numeric, max_abs_pts_60m numeric,
  directional_bias_up_pct  numeric,
  range_expansion_mult     numeric,
  reversal_rate_15m        numeric,
  vol_score                int,
  last_computed_at         timestamptz default now(),
  unique (event_type_id, symbol)
);
create index if not exists historical_reactions_event_type_idx on historical_reactions(event_type_id);

-- ---- 1-min bars cache ----
create table if not exists price_bars_1m (
  symbol     text references symbols(ticker) on delete cascade,
  ts         timestamptz,
  open numeric, high numeric, low numeric, close numeric, volume bigint,
  primary key (symbol, ts)
);
create index if not exists price_bars_1m_symbol_ts_idx on price_bars_1m (symbol, ts desc);

-- ---- baseline volatility per symbol ----
create table if not exists baseline_volatility (
  symbol             text primary key references symbols(ticker) on delete cascade,
  avg_range_930_1100 numeric not null,
  sample_days        int not null,
  last_computed_at   timestamptz default now()
);

-- ---- AI enrichment cache ----
create table if not exists ai_enrichments (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references events(id) on delete cascade,
  kind          text not null,
  model         text not null,
  prompt_hash   text not null,
  payload       jsonb not null,
  tokens_in     int,
  tokens_out    int,
  created_at    timestamptz default now(),
  expires_at    timestamptz not null,
  unique (event_id, kind, prompt_hash)
);
create index if not exists ai_enrichments_event_idx   on ai_enrichments(event_id, kind);
create index if not exists ai_enrichments_expires_idx on ai_enrichments(expires_at);

-- ---- user-facing tables ----
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  handle     text unique,
  tz         text default 'America/New_York',
  created_at timestamptz default now()
);

create table if not exists watchlists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  event_type_id uuid references event_types(id) on delete cascade,
  notify        boolean default true,
  unique (user_id, event_type_id)
);

-- ---- RLS ----
alter table profiles    enable row level security;
alter table watchlists  enable row level security;

drop policy if exists profiles_own       on profiles;
drop policy if exists watchlists_own_sel on watchlists;
drop policy if exists watchlists_own_mod on watchlists;

create policy profiles_own on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy watchlists_own_sel on watchlists
  for select using (user_id = auth.uid());
create policy watchlists_own_mod on watchlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- public-read tables: events, event_types, event_occurrences, symbols, historical_reactions
-- Supabase enforces RLS-by-default; we add permissive select policies so the anon key can read.
alter table events                enable row level security;
alter table event_types           enable row level security;
alter table event_occurrences     enable row level security;
alter table symbols               enable row level security;
alter table historical_reactions  enable row level security;
alter table baseline_volatility   enable row level security;
alter table ai_enrichments        enable row level security;

drop policy if exists public_read_events               on events;
drop policy if exists public_read_event_types          on event_types;
drop policy if exists public_read_event_occurrences    on event_occurrences;
drop policy if exists public_read_symbols              on symbols;
drop policy if exists public_read_historical_reactions on historical_reactions;
drop policy if exists public_read_baseline_volatility  on baseline_volatility;
drop policy if exists public_read_ai_enrichments       on ai_enrichments;

create policy public_read_events               on events               for select using (true);
create policy public_read_event_types          on event_types          for select using (true);
create policy public_read_event_occurrences    on event_occurrences    for select using (true);
create policy public_read_symbols              on symbols              for select using (true);
create policy public_read_historical_reactions on historical_reactions for select using (true);
create policy public_read_baseline_volatility  on baseline_volatility  for select using (true);
create policy public_read_ai_enrichments       on ai_enrichments       for select using (true);
