// Capture actuals for released events.
// Scrapes the ForexFactory calendar (current week), finds events where
// `actual` is now populated, and upserts event_occurrences.actual + released_at.
//
// Run: npm --workspace workers run capture-actuals
// Scheduled: 5,20,35,50 * 7-22 * * 1-5  (every 15min during US+EU sessions, UTC)

import { fetchFFWeeks, normalize } from "./lib/forexfactory.js";
import { getServiceClient } from "./lib/supabase.js";

async function main() {
  console.log("[capture-actuals] fetching ForexFactory current week…");
  const raw = await fetchFFWeeks([0]);
  const events = normalize(raw);

  const withActuals = events.filter((e) => e.actual !== null);
  console.log(`[capture-actuals] ${withActuals.length} events have actuals out of ${events.length}`);
  if (withActuals.length === 0) return;

  const supabase = getServiceClient();

  // Look up event IDs by source_ref. Batch to stay under URL length limits
  // (Supabase rejects requests with header lines > ~16KB).
  const idByRef = new Map<string, string>();
  const refs = withActuals.map((e) => e.source_ref);
  const CHUNK = 80;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const slice = refs.slice(i, i + CHUNK);
    const { data: rows, error: fetchErr } = await supabase
      .from("events")
      .select("id, source_ref")
      .in("source_ref", slice);
    if (fetchErr) throw fetchErr;
    for (const r of rows ?? []) {
      idByRef.set(r.source_ref as string, r.id as string);
    }
  }

  const occRows = withActuals
    .map((e) => {
      const id = idByRef.get(e.source_ref);
      if (!id) return null;
      return {
        event_id: id,
        actual: e.actual,
        forecast: e.forecast,
        previous: e.previous,
        released_at: e.release_at,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (occRows.length === 0) {
    console.log("[capture-actuals] no matching events in DB — nothing to update");
    return;
  }

  for (let i = 0; i < occRows.length; i += 200) {
    const slice = occRows.slice(i, i + 200);
    const { error: upsertErr } = await supabase
      .from("event_occurrences")
      .upsert(slice, { onConflict: "event_id" });
    if (upsertErr) throw upsertErr;
  }

  console.log(`[capture-actuals] upserted actuals for ${occRows.length} events ✓`);
}

main().catch((err) => {
  console.error("[capture-actuals] FAILED:", err);
  process.exit(1);
});
