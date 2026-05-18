// Recompute historical_reactions from price_bars_1m.
// For each (event_type, symbol): gather past events, read their bars, aggregate stats.
//
// Run: npm --workspace workers run recompute-reactions
// Scheduled: nightly 03:30 UTC + Saturday full recompute

import { getServiceClient } from "./lib/supabase.js";
import {
  computeOccurrenceReaction,
  aggregateReactions,
  computeVolScore,
  type AggregatedReaction,
} from "./lib/reaction-engine.js";
import type { PriceBar } from "./lib/prices.js";

interface SymbolRow {
  ticker: string;
  pip_size: number | null;
}

interface EventTypeRow {
  id: string;
  slug: string;
}

interface PastEvent {
  id: string;
  release_at: string;
}

async function main() {
  const fullRecompute = process.argv.includes("--full");
  console.log(`[recompute-reactions] starting (${fullRecompute ? "full" : "incremental"})…`);

  const supabase = getServiceClient();

  const { data: symbols, error: symErr } = await supabase
    .from("symbols")
    .select("ticker, pip_size");
  if (symErr) throw symErr;
  const syms = (symbols ?? []) as SymbolRow[];

  const { data: types, error: typeErr } = await supabase
    .from("event_types")
    .select("id, slug");
  if (typeErr) throw typeErr;
  const eventTypes = (types ?? []) as EventTypeRow[];

  console.log(`[recompute-reactions] ${eventTypes.length} event types × ${syms.length} symbols`);

  // Results accumulator — we need all aggregations to compute vol_score percentile ranks
  const results: Array<{
    event_type_id: string;
    symbol: string;
    reaction: AggregatedReaction;
  }> = [];

  for (const et of eventTypes) {
    // Past events for this event_type (up to 30 most recent)
    const { data: evData, error: evErr } = await supabase
      .from("events")
      .select("id, release_at")
      .eq("event_type_id", et.id)
      .lt("release_at", new Date().toISOString())
      .order("release_at", { ascending: false })
      .limit(30);
    if (evErr) { console.warn(`  event_type ${et.slug}: ${evErr.message}`); continue; }
    const pastEvents = (evData ?? []) as PastEvent[];
    if (pastEvents.length === 0) continue;

    for (const sym of syms) {
      const occurrenceReactions = [];

      for (const ev of pastEvents) {
        const releaseAt = new Date(ev.release_at);
        const windowStart = new Date(releaseAt.getTime() - 130 * 60_000).toISOString();
        const windowEnd   = new Date(releaseAt.getTime() +  70 * 60_000).toISOString();

        const { data: barData, error: barErr } = await supabase
          .from("price_bars_1m")
          .select("symbol, ts, open, high, low, close, volume")
          .eq("symbol", sym.ticker)
          .gte("ts", windowStart)
          .lte("ts", windowEnd)
          .order("ts", { ascending: true });
        if (barErr || !barData || barData.length < 5) continue;

        const bars = barData as PriceBar[];
        const occ = computeOccurrenceReaction(bars, releaseAt, sym.pip_size);
        if (occ.pct_5m !== null) occurrenceReactions.push(occ);
      }

      if (occurrenceReactions.length === 0) continue;

      const agg = aggregateReactions(occurrenceReactions);
      results.push({ event_type_id: et.id, symbol: sym.ticker, reaction: agg });
    }
  }

  console.log(`[recompute-reactions] computed ${results.length} (event_type, symbol) pairs`);

  // vol_score needs all aggregations for percentile ranks
  const allReactions = results.map((r) => r.reaction);

  const upsertRows = results.map(({ event_type_id, symbol, reaction }) => ({
    event_type_id,
    symbol,
    sample_size: reaction.sample_size,
    avg_abs_pct_1m:   reaction.avg_abs_pct_1m,   median_abs_pct_1m:   reaction.median_abs_pct_1m,   max_abs_pct_1m:   reaction.max_abs_pct_1m,
    avg_abs_pct_5m:   reaction.avg_abs_pct_5m,   median_abs_pct_5m:   reaction.median_abs_pct_5m,   max_abs_pct_5m:   reaction.max_abs_pct_5m,
    avg_abs_pct_15m:  reaction.avg_abs_pct_15m,  median_abs_pct_15m:  reaction.median_abs_pct_15m,  max_abs_pct_15m:  reaction.max_abs_pct_15m,
    avg_abs_pct_60m:  reaction.avg_abs_pct_60m,  median_abs_pct_60m:  reaction.median_abs_pct_60m,  max_abs_pct_60m:  reaction.max_abs_pct_60m,
    avg_abs_pts_1m:   reaction.avg_abs_pts_1m,   median_abs_pts_1m:   reaction.median_abs_pts_1m,   max_abs_pts_1m:   reaction.max_abs_pts_1m,
    avg_abs_pts_5m:   reaction.avg_abs_pts_5m,   median_abs_pts_5m:   reaction.median_abs_pts_5m,   max_abs_pts_5m:   reaction.max_abs_pts_5m,
    avg_abs_pts_15m:  reaction.avg_abs_pts_15m,  median_abs_pts_15m:  reaction.median_abs_pts_15m,  max_abs_pts_15m:  reaction.max_abs_pts_15m,
    avg_abs_pts_60m:  reaction.avg_abs_pts_60m,  median_abs_pts_60m:  reaction.median_abs_pts_60m,  max_abs_pts_60m:  reaction.max_abs_pts_60m,
    directional_bias_up_pct: reaction.directional_bias_up_pct,
    reversal_rate_15m: reaction.reversal_rate_15m,
    vol_score: computeVolScore(reaction, allReactions),
    last_computed_at: new Date().toISOString(),
  }));

  if (upsertRows.length === 0) {
    console.log("[recompute-reactions] nothing to upsert — run backfill-bars first");
    return;
  }

  const { error: upsErr } = await supabase
    .from("historical_reactions")
    .upsert(upsertRows, { onConflict: "event_type_id,symbol" });
  if (upsErr) throw upsErr;

  console.log(`[recompute-reactions] upserted ${upsertRows.length} rows ✓`);
}

main().catch((err) => {
  console.error("[recompute-reactions] FAILED:", err);
  process.exit(1);
});
