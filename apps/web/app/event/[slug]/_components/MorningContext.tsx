import type { HistoricalReaction } from "@/lib/types";

interface Props {
  releaseAt: string;
  reaction: HistoricalReaction | null;
}

function releaseHourET(releaseAt: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(releaseAt));
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return (h === 24 ? 0 : h) + m / 60;
}

function framing(releaseAt: string): {
  label: string;
  tagline: string;
  tone: "post" | "concurrent" | "pre";
} {
  const hour = releaseHourET(releaseAt);
  if (hour < 9.5) {
    return {
      label: "Post-event morning reaction",
      tagline: "The 9:30–11 ET window is the historical reaction window for this release.",
      tone: "post",
    };
  }
  if (hour <= 11) {
    return {
      label: "Concurrent — release overlaps window",
      tagline: "Release fires inside the 9:30–11 ET window — stats blend pre and post-release activity.",
      tone: "concurrent",
    };
  }
  return {
    label: "Pre-event morning tradability",
    tagline: "How active is the morning on event days — is there reason to trade before the release?",
    tone: "pre",
  };
}

function fmtRange(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function fmtVol(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}× normal`;
}

function fmtScore(v: number | null): string {
  if (v == null) return "—";
  return `${v}/10`;
}

export function MorningContext({ releaseAt, reaction }: Props) {
  if (!reaction || reaction.avg_intraday_range_pct == null) return null;

  const f = framing(releaseAt);
  const toneClass =
    f.tone === "concurrent"
      ? "border-amber-700/40"
      : f.tone === "pre"
      ? "border-emerald-700/40"
      : "border-[var(--color-border)]";

  return (
    <section className="mt-6">
      <h2 className="text-[11px] uppercase tracking-wider text-[var(--color-text-mute)]">
        Morning context · 9:30–11 ET
      </h2>
      <div
        className={`mt-2 rounded border ${toneClass} bg-[var(--color-surface)] p-4`}
      >
        <div className="mb-1 text-[13px] font-medium">{f.label}</div>
        <div className="mb-3 text-[12px] text-[var(--color-text-dim)]">{f.tagline}</div>
        <div className="grid grid-cols-3 gap-4 text-[13px]">
          <Stat label="Avg range" value={fmtRange(reaction.avg_intraday_range_pct)} />
          <Stat label="Avg volume" value={fmtVol(reaction.avg_intraday_vol_ratio)} />
          <Stat label="Open vol score" value={fmtScore(reaction.open_vol_score)} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">
        {label}
      </div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}
