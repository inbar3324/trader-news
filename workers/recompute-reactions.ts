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
  computeOpenVolScore,
  computeOneMinScore,
  type AggregatedReaction,
  type SymbolBaseline,
} from "./lib/reaction-engine.js";
import type { PriceBar } from "./lib/prices.js";
import { localToUtc } from "./lib/local-time.js";
import { callGemini, QuotaSoftLimitError, QuotaHardLimitError } from "./lib/gemini.js";
import { getCachedEnrichment, upsertEnrichment } from "./lib/enrichment-cache.js";
import {
  buildVolScoreRationalePrompt,
  volScorePercentileLabel,
  VOL_SCORE_RATIONALE_SCHEMA,
} from "./lib/prompts/vol-score-rationale.js";

interface SymbolRow {
  ticker: string;
  pip_size: number | null;
}

interface EventTypeRow {
  id: string;
  slug: string;
  display_name: string;
  category: string;
  description: string | null;
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
    .select("id, slug, display_name, category, description");
  if (typeErr) throw typeErr;
  const eventTypes = (types ?? []) as EventTypeRow[];

  console.log(`[recompute-reactions] ${eventTypes.length} event types × ${syms.length} symbols`);

  // Per-symbol baselines: normal volume (for volume-ratio) and normal noise
  // (typical_5m, typical_15m, typical_90m_range) — used to ground vol_score and
  // open_vol_score in absolute terms instead of relative percentile rank.
  // Sample up to 5000 recent bars per symbol.
  const baselineVolBySymbol = new Map<string, number>();
  const baselineNoiseBySymbol = new Map<string, SymbolBaseline>();
  for (const sym of syms) {
    const { data: rows } = await supabase
      .from("price_bars_1m")
      .select("ts, open, high, low, close, volume")
      .eq("symbol", sym.ticker)
      .order("ts", { ascending: true })
      .limit(5000);
    const bars = (rows ?? []) as Array<{
      ts: string; open: number; high: number; low: number; close: number; volume: number;
    }>;
    if (bars.length < 100) {
      baselineVolBySymbol.set(sym.ticker, 0);
      baselineNoiseBySymbol.set(sym.ticker, { typical_1m: 0, typical_5m: 0, typical_15m: 0, typical_90m_range: 0 });
      continue;
    }

    // Volume baseline
    const vols = bars.map((b) => Number(b.volume)).filter((v) => v > 0);
    const meanVol = vols.length > 0 ? vols.reduce((s, v) => s + v, 0) / vols.length : 0;
    baselineVolBySymbol.set(sym.ticker, meanVol);

    // Typical 5m & 15m absolute return (median across contiguous spans)
    function medianAbsReturn(lookback: number): number {
      const out: number[] = [];
      for (let i = lookback; i < bars.length; i++) {
        const a = bars[i - lookback].close;
        const b = bars[i].close;
        if (!a || a === 0) continue;
        const dt = new Date(bars[i].ts).getTime() - new Date(bars[i - lookback].ts).getTime();
        if (dt > (lookback + 2) * 60_000) continue; // skip across gaps
        out.push(Math.abs((b - a) / a));
      }
      if (out.length === 0) return 0;
      const sorted = out.sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    }

    // Typical 90-min range (median (max_high - min_low)/close across rolling spans)
    function median90mRange(): number {
      const out: number[] = [];
      const step = 30;
      const span = 90;
      for (let i = 0; i + span < bars.length; i += step) {
        const slice = bars.slice(i, i + span);
        const dt = new Date(slice[slice.length - 1].ts).getTime() - new Date(slice[0].ts).getTime();
        if (dt > (span + 10) * 60_000) continue;
        let hi = -Infinity, lo = Infinity;
        for (const b of slice) { if (b.high > hi) hi = b.high; if (b.low < lo) lo = b.low; }
        const ref = slice[0].close;
        if (!ref || ref === 0) continue;
        out.push((hi - lo) / ref);
      }
      if (out.length === 0) return 0;
      const sorted = out.sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    }

    baselineNoiseBySymbol.set(sym.ticker, {
      typical_1m: medianAbsReturn(1),
      typical_5m: medianAbsReturn(5),
      typical_15m: medianAbsReturn(15),
      typical_90m_range: median90mRange(),
    });
  }
  console.log(`[recompute-reactions] baselines computed for ${baselineNoiseBySymbol.size} symbols`);
  for (const sym of syms) {
    const n = baselineNoiseBySymbol.get(sym.ticker)!;
    console.log(
      `  ${sym.ticker.padEnd(8)} typ_1m=${(n.typical_1m * 100).toFixed(4)}%  typ_5m=${(n.typical_5m * 100).toFixed(4)}%  typ_15m=${(n.typical_15m * 100).toFixed(4)}%  typ_90m=${(n.typical_90m_range * 100).toFixed(3)}%`,
    );
  }

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
        // Bars window: union of release ±2h AND 9:30–11 ET on event's NY day.
        // Same logic as backfill-bars — ensures intraday_range_pct uses the full 90-min window.
        const releaseStart = releaseAt.getTime() - 130 * 60_000;
        const releaseEnd   = releaseAt.getTime() +  70 * 60_000;
        const nyFmt = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          year: "numeric", month: "numeric", day: "numeric",
        });
        const nyParts = nyFmt.formatToParts(releaseAt);
        const nyYear  = parseInt(nyParts.find((p) => p.type === "year")!.value, 10);
        const nyMonth = parseInt(nyParts.find((p) => p.type === "month")!.value, 10);
        const nyDay   = parseInt(nyParts.find((p) => p.type === "day")!.value, 10);
        const t930  = localToUtc(nyYear, nyMonth, nyDay,  9, 30, "America/New_York").getTime();
        const t1100 = localToUtc(nyYear, nyMonth, nyDay, 11,  0, "America/New_York").getTime();
        const windowStart = new Date(Math.min(releaseStart, t930  - 5 * 60_000)).toISOString();
        const windowEnd   = new Date(Math.max(releaseEnd,   t1100 + 5 * 60_000)).toISOString();

        const { data: barData, error: barErr } = await supabase
          .from("price_bars_1m")
          .select("symbol, ts, open, high, low, close, volume")
          .eq("symbol", sym.ticker)
          .gte("ts", windowStart)
          .lte("ts", windowEnd)
          .order("ts", { ascending: true });
        if (barErr || !barData || barData.length < 5) continue;

        const bars = barData as PriceBar[];
        const baseline = baselineVolBySymbol.get(sym.ticker) ?? 0;
        const occ = computeOccurrenceReaction(bars, releaseAt, sym.pip_size, baseline);
        if (occ.pct_5m !== null) occurrenceReactions.push(occ);
      }

      if (occurrenceReactions.length === 0) continue;

      const agg = aggregateReactions(occurrenceReactions);
      results.push({ event_type_id: et.id, symbol: sym.ticker, reaction: agg });
    }
  }

  console.log(`[recompute-reactions] computed ${results.length} (event_type, symbol) pairs`);

  const upsertRows = results.map(({ event_type_id, symbol, reaction }) => {
    const baseline = baselineNoiseBySymbol.get(symbol) ?? { typical_1m: 0, typical_5m: 0, typical_15m: 0, typical_90m_range: 0 };
    return {
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
    avg_vol_ratio_5m:  reaction.avg_vol_ratio_5m,  max_vol_ratio_5m:  reaction.max_vol_ratio_5m,
    avg_vol_ratio_15m: reaction.avg_vol_ratio_15m, max_vol_ratio_15m: reaction.max_vol_ratio_15m,
    avg_vol_ratio_60m: reaction.avg_vol_ratio_60m, max_vol_ratio_60m: reaction.max_vol_ratio_60m,
    avg_intraday_range_pct:    reaction.avg_intraday_range_pct,
    median_intraday_range_pct: reaction.median_intraday_range_pct,
    max_intraday_range_pct:    reaction.max_intraday_range_pct,
    avg_intraday_vol_ratio: reaction.avg_intraday_vol_ratio,
    max_intraday_vol_ratio: reaction.max_intraday_vol_ratio,
    directional_bias_up_pct: reaction.directional_bias_up_pct,
    reversal_rate_15m: reaction.reversal_rate_15m,
    vol_score: computeVolScore(reaction, baseline),
    open_vol_score: computeOpenVolScore(reaction, baseline),
    one_min_score: computeOneMinScore(reaction, baseline),
    last_computed_at: new Date().toISOString(),
  };
  });

  if (upsertRows.length === 0) {
    console.log("[recompute-reactions] nothing to upsert — run backfill-bars first");
    return;
  }

  const { error: upsErr } = await supabase
    .from("historical_reactions")
    .upsert(upsertRows, { onConflict: "event_type_id,symbol" });
  if (upsErr) throw upsErr;

  console.log(`[recompute-reactions] upserted ${upsertRows.length} rows ✓`);

  // ---- Vol-score rationale (E.3) ----
  // For each event_type, pick the SPY reaction (or first) and call Gemini for a one-paragraph rationale.
  // Cached in ai_enrichments keyed by (event_type_id, kind='vol_score_rationale', prompt_hash).
  const eventTypeById = new Map(eventTypes.map((et) => [et.id, et] as const));
  const refByEventType = new Map<string, { event_type_id: string; symbol: string; reaction: AggregatedReaction; vol_score: number }>();
  for (const row of upsertRows) {
    if (row.vol_score == null) continue;
    const existing = refByEventType.get(row.event_type_id);
    if (!existing || (existing.symbol !== "SPY" && row.symbol === "SPY")) {
      const reaction = results.find(
        (r) => r.event_type_id === row.event_type_id && r.symbol === row.symbol,
      )?.reaction;
      if (!reaction) continue;
      refByEventType.set(row.event_type_id, {
        event_type_id: row.event_type_id,
        symbol: row.symbol,
        reaction,
        vol_score: row.vol_score,
      });
    }
  }

  let rGenerated = 0, rCached = 0, rSkipped = 0, rFailed = 0;
  let quotaStopped = false;

  for (const ref of refByEventType.values()) {
    if (quotaStopped) break;
    const et = eventTypeById.get(ref.event_type_id);
    if (!et) { rSkipped++; continue; }
    if (ref.reaction.sample_size < 3) { rSkipped++; continue; }

    const promptText = buildVolScoreRationalePrompt({
      display_name: et.display_name,
      slug: et.slug,
      category: et.category,
      description: et.description,
      vol_score: ref.vol_score,
      reference_symbol: ref.symbol,
      sample_size: ref.reaction.sample_size,
      avg_abs_pct_5m: ref.reaction.avg_abs_pct_5m,
      max_abs_pct_15m: ref.reaction.max_abs_pct_15m,
      median_abs_pct_15m: ref.reaction.median_abs_pct_15m,
      directional_bias_up_pct: ref.reaction.directional_bias_up_pct,
      reversal_rate_15m: ref.reaction.reversal_rate_15m,
      vol_score_percentile_label: volScorePercentileLabel(ref.vol_score),
    });

    try {
      const hit = await getCachedEnrichment(supabase, null, "vol_score_rationale", promptText, et.id);
      if (hit) {
        rCached++;
        continue;
      }

      const { json, tokens_in, tokens_out } = await callGemini({
        role: "writer",
        supabase,
        prompt: promptText,
        schema: VOL_SCORE_RATIONALE_SCHEMA,
        useSearch: false,
      });

      await upsertEnrichment(supabase, {
        eventId: null,
        eventTypeId: et.id,
        kind: "vol_score_rationale",
        promptText,
        payload: json!,
        tokens_in,
        tokens_out,
        ttlDays: 14,
      });
      rGenerated++;
    } catch (err) {
      if (err instanceof QuotaSoftLimitError || err instanceof QuotaHardLimitError) {
        console.warn(`[vol-rationale] quota limit reached: ${(err as Error).message} — stopping gracefully.`);
        quotaStopped = true;
        break;
      }
      console.warn(`[vol-rationale] ${et.slug}: ${(err as Error).message}`);
      rFailed++;
    }
  }

  console.log(`[vol-rationale] generated ${rGenerated} / cached ${rCached} / skipped ${rSkipped} / failed ${rFailed}`);
}

main().catch((err) => {
  console.error("[recompute-reactions] FAILED:", err);
  process.exit(1);
});
