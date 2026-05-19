-- Tracks Gemini API usage per day per role (writer / researcher) for quota enforcement
create table if not exists gemini_usage (
  date             date        not null,
  role             text        not null check (role in ('writer', 'researcher')),
  calls_count      int         not null default 0,
  tokens_in_total  bigint      not null default 0,
  tokens_out_total bigint      not null default 0,
  exhausted_at     timestamptz,
  primary key (date, role)
);

-- Atomic increment — called by workers after each successful Gemini call
create or replace function increment_gemini_usage(
  p_date       date,
  p_role       text,
  p_tokens_in  int,
  p_tokens_out int
) returns void language plpgsql security definer as $$
begin
  insert into gemini_usage (date, role, calls_count, tokens_in_total, tokens_out_total)
  values (p_date, p_role, 1, p_tokens_in, p_tokens_out)
  on conflict (date, role) do update set
    calls_count      = gemini_usage.calls_count + 1,
    tokens_in_total  = gemini_usage.tokens_in_total  + excluded.tokens_in_total,
    tokens_out_total = gemini_usage.tokens_out_total + excluded.tokens_out_total;
end;
$$;

-- Public read so the UI can show quota status if needed
alter table gemini_usage enable row level security;
drop policy if exists "gemini_usage_public_read" on gemini_usage;
create policy "gemini_usage_public_read"
  on gemini_usage for select using (true);
