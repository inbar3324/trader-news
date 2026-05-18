"use client";

import { useState } from "react";
import type { HistoricalReaction, Symbol, UnitLabel } from "@/lib/types";

interface Props {
  reactions: HistoricalReaction[];
  symbols: Symbol[];
}

type Window = "1m" | "5m" | "15m" | "60m";
const WINDOWS: Window[] = ["1m", "5m", "15m", "60m"];

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function fmtPts(v: number | null, unit: UnitLabel): string {
  if (v == null) return "—";
  if (unit === "pips")   return `${v.toFixed(1)} pip`;
  if (unit === "points") return `${v.toFixed(2)} pts`;
  return `${v.toFixed(3)} pts`; // ETF: raw price diff
}

function primaryLabel(unit: UnitLabel): string {
  if (unit === "pips")   return "Pips (avg / med / max)";
  if (unit === "points") return "Points (avg / med / max)";
  return "% move (avg / med / max)";
}

function secondaryLabel(unit: UnitLabel): string {
  return unit === "percent" ? "Raw pts" : "% move";
}

function primaryRow(r: HistoricalReaction, sym: Symbol, w: Window): string {
  const unit = sym.unit_label;
  if (unit === "percent") {
    const avg = fmtPct(r[`avg_abs_pct_${w}`]);
    const med = fmtPct(r[`median_abs_pct_${w}`]);
    const max = fmtPct(r[`max_abs_pct_${w}`]);
    return `${avg} / ${med} / ${max}`;
  }
  // pips or points
  const avg = fmtPts(r[`avg_abs_pts_${w}`], unit);
  const med = fmtPts(r[`median_abs_pts_${w}`], unit);
  const max = fmtPts(r[`max_abs_pts_${w}`], unit);
  return `${avg} / ${med} / ${max}`;
}

function secondaryRow(r: HistoricalReaction, sym: Symbol, w: Window): string {
  const unit = sym.unit_label;
  if (unit === "percent") {
    return fmtPts(r[`avg_abs_pts_${w}`], "points");
  }
  return fmtPct(r[`avg_abs_pct_${w}`]);
}

type ReactionKey = keyof HistoricalReaction;
function reactionKey(prefix: string, w: Window): ReactionKey {
  return `${prefix}${w}` as ReactionKey;
}
void reactionKey; // used via template strings above — silence TS

export function ReactionStats({ reactions, symbols }: Props) {
  const symbolMap = new Map(symbols.map((s) => [s.ticker, s]));
  const pairs = reactions
    .map((r) => ({ r, sym: symbolMap.get(r.symbol) }))
    .filter((p): p is { r: HistoricalReaction; sym: Symbol } => p.sym != null);

  const [activeTab, setActiveTab] = useState<string>(pairs[0]?.sym.ticker ?? "");

  if (pairs.length === 0) {
    return (
      <div className="rounded border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-text-mute)]">
        No reaction data yet — run <code className="font-mono">backfill-bars</code> then{" "}
        <code className="font-mono">recompute-reactions</code>.
      </div>
    );
  }

  const active = pairs.find((p) => p.sym.ticker === activeTab) ?? pairs[0];

  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Symbol tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {pairs.map(({ sym, r }) => (
          <button
            key={sym.ticker}
            onClick={() => setActiveTab(sym.ticker)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] uppercase tracking-wider transition-colors ${
              activeTab === sym.ticker
                ? "border-b-2 border-[var(--color-accent)] text-[var(--color-text)]"
                : "text-[var(--color-text-mute)] hover:text-[var(--color-text-dim)]"
            }`}
          >
            {sym.display_name}
            <span className="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-400 font-mono">
              n={r.sample_size}
            </span>
          </button>
        ))}
      </div>

      {/* Reaction table */}
      <div className="overflow-x-auto">
        <table className="tabular w-full text-[13px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">
              <th className="py-2 pl-3 pr-2 text-left w-[50px]">T+</th>
              <th className="py-2 px-2 text-left">{primaryLabel(active.sym.unit_label)}</th>
              <th className="py-2 px-2 text-left text-[var(--color-text-mute)]">
                {secondaryLabel(active.sym.unit_label)} (avg)
              </th>
            </tr>
          </thead>
          <tbody>
            {WINDOWS.map((w) => (
              <tr
                key={w}
                className="border-t border-[var(--color-border)] hover:bg-white/[0.02]"
              >
                <td className="py-2 pl-3 pr-2 font-mono text-[12px] text-[var(--color-text-dim)]">
                  {w}
                </td>
                <td className="py-2 px-2 font-medium">
                  {primaryRow(active.r, active.sym, w)}
                </td>
                <td className="py-2 px-2 text-[var(--color-text-dim)]">
                  {secondaryRow(active.r, active.sym, w)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: directional bias + reversal rate */}
      <div className="flex gap-6 border-t border-[var(--color-border)] px-3 py-2">
        <Stat
          label="Directional bias"
          value={
            active.r.directional_bias_up_pct != null
              ? `${Math.round(active.r.directional_bias_up_pct * 100)}% bullish`
              : "—"
          }
        />
        <Stat
          label="Reversal at T+15m"
          value={
            active.r.reversal_rate_15m != null
              ? `${Math.round(active.r.reversal_rate_15m * 100)}%`
              : "—"
          }
        />
        <Stat
          label="Last computed"
          value={new Date(active.r.last_computed_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">{label}</div>
      <div className="mt-0.5 text-[13px]">{value}</div>
    </div>
  );
}
