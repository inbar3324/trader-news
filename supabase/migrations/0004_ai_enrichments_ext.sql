-- Add event_type_id to ai_enrichments for future E.3 vol-score rows (per-event-type, not per-event)
alter table ai_enrichments
  add column if not exists event_type_id uuid references event_types(id) on delete cascade;

-- Public read RLS (drop-then-create — CREATE POLICY IF NOT EXISTS is not valid Postgres syntax)
alter table ai_enrichments enable row level security;
drop policy if exists "ai_enrichments_public_read" on ai_enrichments;
create policy "ai_enrichments_public_read"
  on ai_enrichments for select using (true);
