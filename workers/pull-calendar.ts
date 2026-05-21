// Pull the next 4 weeks of economic calendar from ForexFactory → Supabase events table.
// Run: npm run worker:pull-calendar
// Scheduled via .github/workflows/pull-calendar.yml

import { fetchFFWeeks, normalize } from "./lib/forexfactory.js";
import { getServiceClient } from "./lib/supabase.js";
import { matchEventType, type EventTypeRow } from "./lib/event-type-matcher.js";

async function main() {
  console.log("[pull-calendar] fetching ForexFactory (this week + 3 future weeks)…");
  const raw = await fetchFFWeeks([0, 1, 2, 3]);
  const events = normalize(raw);
  console.log(`[pull-calendar] normalized ${events.length} events`);

  if (events.length === 0) {
    console.warn("[pull-calendar] no events — exiting without writing");
    return;
  }

  const supabase = getServiceClient();

  // Pull all event_types once for matching
  const { data: typesData, error: typesErr } = await supabase
    .from("event_types")
    .select("id, slug, display_name, currency");
  if (typesErr) throw typesErr;
  const types = (typesData ?? []) as EventTypeRow[];

  // Build upsert rows
  const rows = events.map((e) => {
    const type = matchEventType(e.title, e.currency, types);
    return {
      event_type_id: type?.id ?? null,
      title: e.title,
      release_at: e.release_at,
      impact: e.impact,
      currency: e.currency,
      source: e.source,
      source_ref: e.source_ref,
    };
  });

  const matchedCount = rows.filter((r) => r.event_type_id !== null).length;
  console.log(
    `[pull-calendar] matched ${matchedCount}/${rows.length} to event_types (unmatched will still be saved)`,
  );

  // Upsert events on (source, source_ref) — schema's unique constraint.
  // Use .select() so we get the ids back without a separate query (avoids
  // 16KB URL-length limit when looking up hundreds of source_refs).
  const { data: upserted, error: upsertErr } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "source,source_ref" })
    .select("id, source, source_ref");
  if (upsertErr) throw upsertErr;
  console.log(`[pull-calendar] upserted ${upserted?.length ?? rows.length} events ✓`);

  // Pre-create event_occurrences rows with forecast/previous so the calendar
  // shows them immediately.
  const idBySource = new Map(
    (upserted ?? []).map((r) => [`${r.source}:${r.source_ref}`, r.id as string]),
  );
  const occRows: Array<{ event_id: string; forecast: number | null; previous: number | null }> = [];
  for (let i = 0; i < rows.length; i++) {
    const id = idBySource.get(`${rows[i].source}:${rows[i].source_ref}`);
    if (!id) continue;
    occRows.push({
      event_id: id,
      forecast: events[i].forecast,
      previous: events[i].previous,
    });
  }

  if (occRows.length > 0) {
    // Batch occurrence upserts in chunks to stay under request size limits.
    const CHUNK = 200;
    let total = 0;
    for (let i = 0; i < occRows.length; i += CHUNK) {
      const slice = occRows.slice(i, i + CHUNK);
      const { error: occErr } = await supabase
        .from("event_occurrences")
        .upsert(slice, { onConflict: "event_id" });
      if (occErr) throw occErr;
      total += slice.length;
    }
    console.log(`[pull-calendar] upserted ${total} occurrence rows ✓`);
  }
}

main().catch((err) => {
  console.error("[pull-calendar] FAILED:", err);
  process.exit(1);
});
