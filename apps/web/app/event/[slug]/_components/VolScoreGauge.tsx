"use client";

interface Props {
  score: number; // 1–10
  rationale?: string | null;
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

export function VolScoreGauge({ score, rationale }: Props) {
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">
        Volatility score
      </div>
      <div className="mt-2 flex items-end gap-3">
        <span className={`text-4xl font-semibold tabular-nums leading-none ${scoreColor(score)}`}>
          {score}
        </span>
        <span className="mb-1 text-[var(--color-text-mute)]">/10</span>
      </div>
      <div className="mt-2 flex gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-sm transition-colors ${segmentColor(i, score)}`}
          />
        ))}
      </div>
      {rationale && (
        <p className="mt-2 text-[11px] text-[var(--color-text-dim)] leading-relaxed">
          {rationale}
        </p>
      )}
    </div>
  );
}
