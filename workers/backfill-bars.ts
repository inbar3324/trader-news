// Fetch and store 1-min price bars around past event releases.
// Uses yahoo-finance2 — only works for events within the last ~30 trading days.
//
// Run: npm --workspace workers run backfill-bars
// Scheduled: Saturday 04:00 UTC
// Manual: npm --workspace workers run backfill-bars -- --event=us-cpi-yoy

import { getServiceClient } from "./lib/supabase.js";
import { fetchBarsAroundEvent, sleep } from "./lib/prices.js";

interface SymbolRow {
  ticker: string;
  yf_symbol: string;
  unit_label: string;
}

interface EventRow {
  id: string;
  event_type_id: string;
  release_at: string;
  event_types: { slug: string } | null;
}

async function main() {
  const slugFilter = process.argv.find((a) => a.startsWith("--event="))?.split("=")[1];
  console.log(`[backfill-bars] starting${slugFilter ? ` (filter: ${slugFilter})` : ""}…`);

  const supabase = getServiceClient();

  // All symbols we track
  const { data: symbols, error: symErr } = await supabase
    .from("symbols")
    .select("ticker, yf_symbol, unit_label");
  if (symErr) throw symErr;
  const syms = (symbols ?? []) as SymbolRow[];
  console.log(`[backfill-bars] tracking ${syms.length} symbols`);

  // Past events in last 28 days with an event_type (so we can compute reactions later)
  const cutoff = new Date(Date.now() - 28 * 24 * 3600_000).toISOString();
  let q = supabase
    .from("events")
    .select("id, event_type_id, release_at, event_types!inner(slug)")
    .not("event_type_id", "is", null)
    .lt("release_at", new Date().toISOString())
    .gte("release_at", cutoff)
    .order("release_at", { ascending: false });

  if (slugFilter) {
    q = q.eq("event_types.slug", slugFilter);
  }

  const { data: events, error: evErr } = await q;
  if (evErr) throw evErr;
  const evs = (events ?? []) as unknown as EventRow[];
  console.log(`[backfill-bars] ${evs.length} past events to process`);

  let fetched = 0;
  let skipped = 0;

  for (const ev of evs) {
    const releaseAt = new Date(ev.release_at);

    for (const sym of syms) {
      // Check if we already have bars for this window
      const windowStart = new Date(releaseAt.getTime() - 120 * 60_000).toISOString();
      const windowEnd   = new Date(releaseAt.getTime() + 120 * 60_000).toISOString();

      const { count } = await supabase
        .from("price_bars_1m")
        .select("ts", { count: "exact", head: true })
        .eq("symbol", sym.ticker)
        .gte("ts", windowStart)
        .lte("ts", windowEnd);

      if ((count ?? 0) >= 60) {
        skipped++;
        continue;
      }

      console.log(`[backfill-bars] fetching ${sym.ticker} @ ${ev.release_at}`);
      const bars = await fetchBarsAroundEvent(sym.yf_symbol, sym.ticker, releaseAt, 120);

      if (bars.length === 0) {
        console.log(`  → no data (too old or market closed)`);
        skipped++;
        continue;
      }

      const { error: insErr } = await supabase
        .from("price_bars_1m")
        .upsert(bars, { onConflict: "symbol,ts" });
      if (insErr) {
        console.warn(`  → upsert error: ${insErr.message}`);
      } else {
        console.log(`  → stored ${bars.length} bars ✓`);
        fetched++;
      }

      // Respect yfinance rate limits
      await sleep(1500);
    }
  }

  console.log(`[backfill-bars] done — fetched ${fetched} windows, skipped ${skipped} ✓`);
}

main().catch((err) => {
  console.error("[backfill-bars] FAILED:", err);
  process.exit(1);
});
