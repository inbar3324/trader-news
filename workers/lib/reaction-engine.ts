// Pure stat functions for computing historical market reactions.
// No side effects, no DB access — safe to import from both workers and web.

import type { PriceBar } from "./prices.js";

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
  // intraday range (9:30–11:00 ET), null if bars outside this window
  intraday_range_pct: number | null;
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

// pipSize=null means "use percent only, pts = raw price diff"
export function computeOccurrenceReaction(
  bars: PriceBar[],
  releaseAt: Date,
  pipSize: number | null,
): PerOccurrenceReaction {
  const refRaw = closeAt(bars, new Date(releaseAt.getTime() - 60_000));
  if (refRaw == null || refRaw === 0) {
    return { releaseAt, pct_1m: null, pct_5m: null, pct_15m: null, pct_60m: null,
             pts_1m: null, pts_5m: null, pts_15m: null, pts_60m: null,
             intraday_range_pct: null, reversal: null, direction_up: null };
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

  // intraday range 9:30–11:00 ET (13:30–15:00 UTC)
  const rel = releaseAt.getTime();
  const nyOffset = -5 * 3600_000; // EST (close enough, no DST handling for simplicity)
  const relNY = rel + nyOffset; // relative to NY midnight
  const dayStart = rel - (relNY % 86400_000); // UTC midnight of the NY date
  const t930 = dayStart - nyOffset + 9.5 * 3600_000;
  const t1100 = dayStart - nyOffset + 11 * 3600_000;
  const intradayBars = bars.filter((b) => {
    const t = new Date(b.ts).getTime();
    return t >= t930 && t <= t1100;
  });
  let intraday_range_pct: number | null = null;
  if (intradayBars.length >= 10) {
    const hi = Math.max(...intradayBars.map((b) => b.high));
    const lo = Math.min(...intradayBars.map((b) => b.low));
    intraday_range_pct = (hi - lo) / ref;
  }

  const reversal = p2 != null && p15 != null ? Math.sign(p2) !== Math.sign(p15) : null;

  return {
    releaseAt,
    pct_1m: p1, pct_5m: p5, pct_15m: p15, pct_60m: p60,
    pts_1m: pts(p1), pts_5m: pts(p5), pts_15m: pts(p15), pts_60m: pts(p60),
    intraday_range_pct,
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

  const [ap1,  mp1,  xp1]  = absStats(col("pct_1m"));
  const [ap5,  mp5,  xp5]  = absStats(col("pct_5m"));
  const [ap15, mp15, xp15] = absStats(col("pct_15m"));
  const [ap60, mp60, xp60] = absStats(col("pct_60m"));
  const [at1,  mt1,  xt1]  = absStats(col("pts_1m"));
  const [at5,  mt5,  xt5]  = absStats(col("pts_5m"));
  const [at15, mt15, xt15] = absStats(col("pts_15m"));
  const [at60, mt60, xt60] = absStats(col("pts_60m"));

  const ups = col("direction_up" as keyof PerOccurrenceReaction) as unknown as (boolean | null)[];
  const upVals = occurrences.map((o) => o.direction_up).filter((v): v is boolean => v != null);
  const directional_bias_up_pct = upVals.length > 0 ? upVals.filter(Boolean).length / upVals.length : null;

  const revVals = occurrences.map((o) => o.reversal).filter((v): v is boolean => v != null);
  const reversal_rate_15m = revVals.length > 0 ? revVals.filter(Boolean).length / revVals.length : null;

  void ups;

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
    directional_bias_up_pct,
    reversal_rate_15m,
  };
}

// Percentile rank of value in a sorted ascending array (0..1).
export function percentileRank(value: number, sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0.5;
  let below = 0;
  for (const v of sortedAsc) if (v < value) below++;
  return below / sortedAsc.length;
}

// Compute vol_score 1–10 for one reaction given the full set of reactions.
// Uses deterministic percentile rank — no LLM math.
export function computeVolScore(
  reaction: AggregatedReaction,
  allReactions: AggregatedReaction[],
): number {
  const avg5ms = allReactions
    .map((r) => r.avg_abs_pct_5m)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  const max15ms = allReactions
    .map((r) => r.max_abs_pct_15m)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);

  const r5  = reaction.avg_abs_pct_5m  != null ? percentileRank(reaction.avg_abs_pct_5m,  avg5ms)  : 0.5;
  const r15 = reaction.max_abs_pct_15m != null ? percentileRank(reaction.max_abs_pct_15m, max15ms) : 0.5;

  const raw = 0.7 * r5 + 0.3 * r15;
  return Math.max(1, Math.min(10, Math.round(raw * 10)));
}
