-- Auth: RLS policies for user-scoped tables + profile auto-creation trigger.
-- Idempotent — safe to re-run.

-- ─── Enable RLS ─────────────────────────────────────────────────────────────
alter table profiles  enable row level security;
alter table watchlists enable row level security;

-- Public read tables — enable RLS but allow all reads, no writes from client.
alter table events             enable row level security;
alter table event_types        enable row level security;
alter table event_occurrences  enable row level security;
alter table symbols            enable row level security;
alter table historical_reactions enable row level security;
alter table ai_enrichments     enable row level security;
alter table price_bars_1m      enable row level security;
alter table baseline_volatility enable row level security;

-- ─── Public read policies ────────────────────────────────────────────────────
drop policy if exists "public read events"               on events;
drop policy if exists "public read event_types"          on event_types;
drop policy if exists "public read event_occurrences"    on event_occurrences;
drop policy if exists "public read symbols"              on symbols;
drop policy if exists "public read historical_reactions" on historical_reactions;
drop policy if exists "public read ai_enrichments"       on ai_enrichments;
drop policy if exists "public read price_bars_1m"        on price_bars_1m;
drop policy if exists "public read baseline_volatility"  on baseline_volatility;

create policy "public read events"               on events             for select using (true);
create policy "public read event_types"          on event_types        for select using (true);
create policy "public read event_occurrences"    on event_occurrences  for select using (true);
create policy "public read symbols"              on symbols            for select using (true);
create policy "public read historical_reactions" on historical_reactions for select using (true);
create policy "public read ai_enrichments"       on ai_enrichments     for select using (true);
create policy "public read price_bars_1m"        on price_bars_1m      for select using (true);
create policy "public read baseline_volatility"  on baseline_volatility for select using (true);

-- ─── User-scoped policies ────────────────────────────────────────────────────
drop policy if exists "profiles own"   on profiles;
drop policy if exists "watchlists own" on watchlists;

create policy "profiles own"
  on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "watchlists own"
  on watchlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Auto-create profile on signup ──────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
