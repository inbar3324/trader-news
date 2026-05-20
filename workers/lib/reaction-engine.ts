// Pure stat functions for computing historical market reactions.
// No side effects, no DB access — safe to import from both workers and web.

import type { PriceBar } from "./prices.js";
import { localToUtc } from "./local-time.js";

export interface PerOccurrenceReaction {
  releaseAt: Date;
  // raw price diffs from close at T-1m
  pct_1m:  number | null;
  pct_5m:  number | null;
  pct_15m: number | null;
  pct_60m: number | null;
  pts_1m:  number | null;
  pts_5m:  number | null;
  pts_15m: number | null;
  pts_60m: number | null;
  // post-release volume vs symbol baseline (1.0 = normal, 2.0 = double)
  vol_ratio_5m:  number | null;
  vol_ratio_15m: number | null;
  vol_ratio_60m: number | null;
  // 9:30–11 ET window (day-anchored, NOT release-anchored)
  intraday_range_pct: number | null;
  intraday_vol_ratio: number | null;
  reversal: boolean | null; // sign(pct_2m) != sign(pct_15m)
  direction_up: boolean | null;
}

export interface AggregatedStats {
  avg: number;
  median: number;
  max: number;
}

export interface AggregatedReaction {
  sample_size: number;
  avg_abs_pct_1m:  number | null; median_abs_pct_1m:  number | null; max_abs_pct_1m:  number | null;
  avg_abs_pct_5m:  number | null; median_abs_pct_5m:  number | null; max_abs_pct_5m:  number | null;
  avg_abs_pct_15m: number | null; median_abs_pct_15m: number | null; max_abs_pct_15m: number | null;
  avg_abs_pct_60m: number | null; median_abs_pct_60m: number | null; max_abs_pct_60m: number | null;
  avg_abs_pts_1m:  number | null; median_abs_pts_1m:  number | null; max_abs_pts_1m:  number | null;
  avg_abs_pts_5m:  number | null; median_abs_pts_5m:  number | null; max_abs_pts_5m:  number | null;
  avg_abs_pts_15m: number | null; median_abs_pts_15m: number | null; max_abs_pts_15m: number | null;
  avg_abs_pts_60m: number | null; median_abs_pts_60m: number | null; max_abs_pts_60m: number | null;
  avg_vol_ratio_5m:  number | null; max_vol_ratio_5m:  number | null;
  avg_vol_ratio_15m: number | null; max_vol_ratio_15m: number | null;
  avg_vol_ratio_60m: number | null; max_vol_ratio_60m: number | null;
  avg_intraday_range_pct:    number | null;
  median_intraday_range_pct: number | null;
  max_intraday_range_pct:    number | null;
  avg_intraday_vol_ratio: number | null;
  max_intraday_vol_ratio: number | null;
  directional_bias_up_pct: number | null;
  reversal_rate_15m: number | null;
}

export function aggStats(values: number[]): AggregatedStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  return { avg, median, max: sorted[sorted.length - 1] };
}

function closeAt(bars: PriceBar[], ts: Date, toleranceMs = 90_000): number | null {
  const t = ts.getTime();
  let best: PriceBar | null = null;
  let bestDiff = Infinity;
  for (const b of bars) {
    const diff = Math.abs(new Date(b.ts).getTime() - t);
    if (diff < bestDiff && diff <= toleranceMs) { bestDiff = diff; best = b; }
  }
  return best?.close ?? null;
}

function sumVolumeInWindow(bars: PriceBar[], fromMs: number, toMs: number): { sum: number; count: number } {
  let sum = 0, count = 0;
  for (const b of bars) {
    const t = new Date(b.ts).getTime();
    if (t >= fromMs && t <= toMs) { sum += b.volume; count++; }
  }
  return { sum, count };
}

function volRatio(sum: number, count: number, expectedMinutes: number, baselineVolPerMin: number): number | null {
  if (baselineVolPerMin <= 0) return null;
  if (count < expectedMinutes * 0.5) return null;
  return sum / (baselineVolPerMin * expectedMinutes);
}

// pipSize=null means "use percent only, pts = raw price diff"
// baselineVolPerMin=0 disables volume ratios (used when caller has no baseline)
export function computeOccurrenceReaction(
  bars: PriceBar[],
  releaseAt: Date,
  pipSize: number | null,
  baselineVolPerMin: number = 0,
): PerOccurrenceReaction {
  const refRaw = closeAt(bars, new Date(releaseAt.getTime() - 60_000));
  if (refRaw == null || refRaw === 0) {
    return { releaseAt,
             pct_1m: null, pct_5m: null, pct_15m: null, pct_60m: null,
             pts_1m: null, pts_5m: null, pts_15m: null, pts_60m: null,
             vol_ratio_5m: null, vol_ratio_15m: null, vol_ratio_60m: null,
             intraday_range_pct: null, intraday_vol_ratio: null,
             reversal: null, direction_up: null };
  }
  const ref: number = refRaw;

  function pct(offsetMin: number) {
    const c = closeAt(bars, new Date(releaseAt.getTime() + offsetMin * 60_000));
    return c != null ? (c - ref) / ref : null;
  }
  function pts(pctVal: number | null) {
    if (pctVal == null) return null;
    const rawPts = pctVal * ref;
    return pipSize != null ? rawPts / pipSize : rawPts;
  }

  const p1 = pct(1), p5 = pct(5), p15 = pct(15), p60 = pct(60);
  const p2 = pct(2); // used for reversal calc

  const releaseMs = releaseAt.getTime();
  const v5  = sumVolumeInWindow(bars, releaseMs, releaseMs + 5  * 60_000);
  const v15 = sumVolumeInWindow(bars, releaseMs, releaseMs + 15 * 60_000);
  const v60 = sumVolumeInWindow(bars, releaseMs, releaseMs + 60 * 60_000);
  const vol_ratio_5m  = volRatio(v5.sum,  v5.count,  5,  baselineVolPerMin);
  const vol_ratio_15m = volRatio(v15.sum, v15.count, 15, baselineVolPerMin);
  const vol_ratio_60m = volRatio(v60.sum, v60.count, 60, baselineVolPerMin);

  // 9:30–11 ET window (DST-correct via Intl). NY date is determined from releaseAt
  // converted to America/New_York wall-clock.
  const nyFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "numeric", day: "numeric",
  });
  const nyParts = nyFmt.formatToParts(releaseAt);
  const nyYear  = parseInt(nyParts.find((p) => p.type === "year")!.value, 10);
  const nyMonth = parseInt(nyParts.find((p) => p.type === "month")!.value, 10);
  const nyDay   = parseInt(nyParts.find((p) => p.type === "day")!.value, 10);
  const t930  = localToUtc(nyYear, nyMonth, nyDay, 9, 30, "America/New_York").getTime();
  const t1100 = localToUtc(nyYear, nyMonth, nyDay, 11, 0, "America/New_York").getTime();

  const intradayBars: PriceBar[] = [];
  let intradayVolSum = 0;
  for (const b of bars) {
    const t = new Date(b.ts).getTime();
    if (t >= t930 && t <= t1100) {
      intradayBars.push(b);
      intradayVolSum += b.volume;
    }
  }
  let intraday_range_pct: number | null = null;
  let intraday_vol_ratio: number | null = null;
  if (intradayBars.length >= 10) {
    const hi = Math.max(...intradayBars.map((b) => b.high));
    const lo = Math.min(...intradayBars.map((b) => b.low));
    intraday_range_pct = (hi - lo) / ref;
    intraday_vol_ratio = volRatio(intradayVolSum, intradayBars.length, intradayBars.length, baselineVolPerMin);
  }

  const reversal = p2 != null && p15 != null ? Math.sign(p2) !== Math.sign(p15) : null;

  return {
    releaseAt,
    pct_1m: p1, pct_5m: p5, pct_15m: p15, pct_60m: p60,
    pts_1m: pts(p1), pts_5m: pts(p5), pts_15m: pts(p15), pts_60m: pts(p60),
    vol_ratio_5m, vol_ratio_15m, vol_ratio_60m,
    intraday_range_pct, intraday_vol_ratio,
    reversal,
    direction_up: p5 != null ? p5 >= 0 : null,
  };
}

export function aggregateReactions(occurrences: PerOccurrenceReaction[]): AggregatedReaction {
  function col<K extends keyof PerOccurrenceReaction>(key: K): number[] {
    return occurrences.map((o) => o[key] as number | null).filter((v): v is number => v != null);
  }

  function absStats(vals: number[]): [number | null, number | null, number | null] {
    const s = aggStats(vals.map(Math.abs));
    return s ? [s.avg, s.median, s.max] : [null, null, null];
  }

  function avgMax(vals: number[]): [number | null, number | null] {
    const s = aggStats(vals);
    return s ? [s.avg, s.max] : [null, null];
  }

  function avgMedMax(vals: number[]): [number | null, number | null, number | null] {
    const s = aggStats(vals);
    return s ? [s.avg, s.median, s.max] : [null, null, null];
  }

  const [ap1,  mp1,  xp1]  = absStats(col("pct_1m"));
  const [ap5,  mp5,  xp5]  = absStats(col("pct_5m"));
  const [ap15, mp15, xp15] = absStats(col("pct_15m"));
  const [ap60, mp60, xp60] = absStats(col("pct_60m"));
  const [at1,  mt1,  xt1]  = absStats(col("pts_1m"));
  const [at5,  mt5,  xt5]  = absStats(col("pts_5m"));
  const [at15, mt15, xt15] = absStats(col("pts_15m"));
  const [at60, mt60, xt60] = absStats(col("pts_60m"));

  const [av5,  xv5]  = avgMax(col("vol_ratio_5m"));
  const [av15, xv15] = avgMax(col("vol_ratio_15m"));
  const [av60, xv60] = avgMax(col("vol_ratio_60m"));

  const [airange, mirange, xirange] = avgMedMax(col("intraday_range_pct"));
  const [aivol, xivol] = avgMax(col("intraday_vol_ratio"));

  const upVals = occurrences.map((o) => o.direction_up).filter((v): v is boolean => v != null);
  const directional_bias_up_pct = upVals.length > 0 ? upVals.filter(Boolean).length / upVals.length : null;

  const revVals = occurrences.map((o) => o.reversal).filter((v): v is boolean => v != null);
  const reversal_rate_15m = revVals.length > 0 ? revVals.filter(Boolean).length / revVals.length : null;

  return {
    sample_size: occurrences.length,
    avg_abs_pct_1m: ap1, median_abs_pct_1m: mp1, max_abs_pct_1m: xp1,
    avg_abs_pct_5m: ap5, median_abs_pct_5m: mp5, max_abs_pct_5m: xp5,
    avg_abs_pct_15m: ap15, median_abs_pct_15m: mp15, max_abs_pct_15m: xp15,
    avg_abs_pct_60m: ap60, median_abs_pct_60m: mp60, max_abs_pct_60m: xp60,
    avg_abs_pts_1m: at1, median_abs_pts_1m: mt1, max_abs_pts_1m: xt1,
    avg_abs_pts_5m: at5, median_abs_pts_5m: mt5, max_abs_pts_5m: xt5,
    avg_abs_pts_15m: at15, median_abs_pts_15m: mt15, max_abs_pts_15m: xt15,
    avg_abs_pts_60m: at60, median_abs_pts_60m: mt60, max_abs_pts_60m: xt60,
    avg_vol_ratio_5m: av5,  max_vol_ratio_5m: xv5,
    avg_vol_ratio_15m: av15, max_vol_ratio_15m: xv15,
    avg_vol_ratio_60m: av60, max_vol_ratio_60m: xv60,
    avg_intraday_range_pct: airange,
    median_intraday_range_pct: mirange,
    max_intraday_range_pct: xirange,
    avg_intraday_vol_ratio: aivol,
    max_intraday_vol_ratio: xivol,
    directional_bias_up_pct,
    reversal_rate_15m,
  };
}

// Per-symbol noise baseline used to ground vol scores in absolute (not relative)
// terms. typical_5m / typical_15m are the median |% return| over 5/15-min windows
// across non-event bars. typical_90m_range is the median (high-low)/close over
// rolling 90-min spans — proxy for the symbol's normal 9:30–11 ET range.
export interface SymbolBaseline {
  typical_1m: number;
  typical_5m: number;
  typical_15m: number;
  typical_90m_range: number;
}

// Magnitude-based 1-min reaction score 1–10. Same logic as vol_score but for the
// very first minute after release — captures the "instant spike" effect.
// ×1 noise → 2-3, ×2 → 5, ×4 → 10.
export function computeOneMinScore(
  reaction: AggregatedReaction,
  baseline: SymbolBaseline,
): number | null {
  if (reaction.avg_abs_pct_1m == null || baseline.typical_1m <= 0) return null;
  const ratio = reaction.avg_abs_pct_1m / baseline.typical_1m;
  return Math.max(1, Math.min(10, Math.round(ratio * 2.5)));
}

// Magnitude-based vol_score 1–10. Compares the event reaction to the symbol's
// own normal 5-min and 15-min noise levels. ×1 noise → 2-3, ×2 → 5, ×4 → 10.
export function computeVolScore(
  reaction: AggregatedReaction,
  baseline: SymbolBaseline,
): number | null {
  if (reaction.avg_abs_pct_5m == null || baseline.typical_5m <= 0) return null;
  const r5 = reaction.avg_abs_pct_5m / baseline.typical_5m;
  const r15 =
    reaction.max_abs_pct_15m != null && baseline.typical_15m > 0
      ? reaction.max_abs_pct_15m / baseline.typical_15m
      : r5;
  const ratio = 0.7 * r5 + 0.3 * r15;
  return Math.max(1, Math.min(10, Math.round(ratio * 2.5)));
}

// Magnitude-based open_vol_score 1–10. Compares 9:30–11 ET range on event days
// to the symbol's normal 90-min range. Anchored at 5 = average:
//   ×0.5 (half of normal) → 3, ×1.0 (= avg) → 5, ×1.5 → 8, ×2.0+ → 10.
export function computeOpenVolScore(
  reaction: AggregatedReaction,
  baseline: SymbolBaseline,
): number | null {
  if (reaction.avg_intraday_range_pct == null || baseline.typical_90m_range <= 0) return null;
  const ratio = reaction.avg_intraday_range_pct / baseline.typical_90m_range;
  return Math.max(1, Math.min(10, Math.round(ratio * 5)));
}
