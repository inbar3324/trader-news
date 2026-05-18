// Pull this week's economic calendar from FairEconomy → Supabase events table.
// Run: npm run worker:pull-calendar
// Scheduled via .github/workflows/pull-calendar.yml

import { fetchFairEconomyWeek, normalize, type NormalizedEvent } from "./lib/faireconomy.js";
import { getServiceClient } from "./lib/supabase.js";

interface EventTypeRow {
  id: string;
  slug: string;
  display_name: string;
  currency: string;
}

// Match a FairEconomy event title to an event_type row using simple heuristics.
// Returns null if no confident match.
function matchEventType(
  ev: NormalizedEvent,
  types: EventTypeRow[],
): EventTypeRow | null {
  const t = ev.title.toLowerCase();
  const ccy = ev.currency;

  const candidates = types.filter((x) => x.currency === ccy);
  // exact-ish display_name comparison first
  let best: EventTypeRow | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const name = c.display_name.toLowerCase();
    let score = 0;
    if (t === name) score = 100;
    else if (t.includes(name) || name.includes(t)) score = 80;
    else {
      // token overlap
      const tt = new Set(t.split(/[\s/]+/).filter(Boolean));
      const nt = new Set(name.split(/[\s/]+/).filter(Boolean));
      let overlap = 0;
      for (const w of tt) if (nt.has(w)) overlap++;
      score = (overlap / Math.max(nt.size, 1)) * 70;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 60 ? best : null;
}

async function main() {
  console.log("[pull-calendar] fetching FairEconomy feed…");
  const raw = await fetchFairEconomyWeek();
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
    const type = matchEventType(e, types);
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

  // Upsert events on (source, source_ref) — schema's unique constraint
  const { error: upsertErr, count } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "source,source_ref", count: "exact" });
  if (upsertErr) throw upsertErr;
  console.log(`[pull-calendar] upserted ${count ?? rows.length} events ✓`);

  // Pre-create event_occurrences rows with forecast/previous so the calendar shows them immediately
  const occRows = [];
  const { data: ids, error: idsErr } = await supabase
    .from("events")
    .select("id, source, source_ref")
    .in(
      "source_ref",
      rows.map((r) => r.source_ref),
    );
  if (idsErr) throw idsErr;

  const idBySource = new Map((ids ?? []).map((r) => [`${r.source}:${r.source_ref}`, r.id]));
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
    const { error: occErr } = await supabase
      .from("event_occurrences")
      .upsert(occRows, { onConflict: "event_id" });
    if (occErr) throw occErr;
    console.log(`[pull-calendar] upserted ${occRows.length} occurrence rows ✓`);
  }
}

main().catch((err) => {
  console.error("[pull-calendar] FAILED:", err);
  process.exit(1);
});
