"use client";

import type { HistoricalReaction, Symbol } from "@/lib/types";

interface SingleGaugeProps {
  title: string;
  subtitle: string;
  score: number | null;
  context: string;
  emptyHint?: string;
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-red-400";
  if (score >= 6) return "text-amber-400";
  if (score >= 4) return "text-yellow-300";
  return "text-zinc-400";
}

function segmentColor(i: number, score: number): string {
  if (i >= score) return "bg-zinc-800";
  if (score >= 8) return "bg-red-500";
  if (score >= 6) return "bg-amber-500";
  return "bg-yellow-400";
}

function SingleGauge({ title, subtitle, score, context, emptyHint }: SingleGaugeProps) {
  const empty = score == null;
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text)] font-medium">
        {title}
      </div>
      <div className="text-[10px] text-[var(--color-text-mute)] leading-tight">
        {subtitle}
      </div>
      <div className="mt-2 flex items-end gap-1">
        <span
          className={`text-2xl font-semibold tabular-nums leading-none ${
            empty ? "text-[var(--color-text-mute)]" : scoreColor(score!)
          }`}
        >
          {empty ? "—" : score}
        </span>
        <span className="mb-0.5 text-[var(--color-text-mute)] text-xs">/10</span>
      </div>
      <div className="mt-2 flex gap-[2px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-sm transition-colors ${
              empty ? "bg-zinc-800" : segmentColor(i, score!)
            }`}
          />
        ))}
      </div>
      <div className="mt-2 whitespace-pre-line text-[10px] font-mono text-[var(--color-text-dim)] leading-tight">
        {empty ? (emptyHint ?? "need 3+ past events") : context}
      </div>
    </div>
  );
}

interface Props {
  score: number | null;
  openScore: number | null;
  oneMinScore: number | null;
  rationale?: string | null;
  reaction: HistoricalReaction | null;
  symbol: Symbol | null;
}

function fmtPts(v: number | null, unit: string): string {
  if (v == null) return "—";
  if (unit === "pips")   return `${v.toFixed(1)} pips`;
  if (unit === "points") return `${v.toFixed(1)} pts`;
  return `$${v.toFixed(2)}`;
}

// Derive native-unit range from intraday_range_pct using the avg_abs_pts_5m/pct_5m ratio
// as a proxy for "1% in points/pips/$". Works for ETF (raw $), futures (raw pts), FX (pips).
function nativeUnitPerPct(reaction: HistoricalReaction | null): number | null {
  if (!reaction) return null;
  const pts = reaction.avg_abs_pts_5m;
  const pct = reaction.avg_abs_pct_5m;
  if (pts == null || pct == null || pct === 0) return null;
  return pts / pct;
}

export function VolScoreGauge({ score, openScore, oneMinScore, rationale, reaction, symbol }: Props) {
  const unit = symbol?.unit_label ?? "percent";

  const unitsPerPct = nativeUnitPerPct(reaction);
  const intradayPct = reaction?.avg_intraday_range_pct ?? null;
  const intradayUnits = intradayPct != null && unitsPerPct != null ? intradayPct * unitsPerPct : null;

  const oneMinContext  = reaction?.avg_abs_pts_1m != null ? `avg: ${fmtPts(reaction.avg_abs_pts_1m, unit)}` : "—";
  const reactionContext = reaction?.avg_abs_pts_5m != null ? `avg: ${fmtPts(reaction.avg_abs_pts_5m, unit)}` : "—";
  const openContext     = intradayUnits != null ? `avg: ${fmtPts(intradayUnits, unit)}` : "—";

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <SingleGauge
          title="1-min spike"
          subtitle="first minute after release"
          score={oneMinScore}
          context={oneMinContext}
        />
        <SingleGauge
          title="Reaction"
          subtitle="first 5–15 min after release"
          score={score}
          context={reactionContext}
        />
        <SingleGauge
          title="Morning range"
          subtitle="9:30–11 ET vs normal"
          score={openScore}
          context={openContext}
        />
      </div>
      {rationale && (
        <p className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[11px] text-[var(--color-text-dim)] leading-relaxed">
          {rationale}
        </p>
      )}
    </div>
  );
}
