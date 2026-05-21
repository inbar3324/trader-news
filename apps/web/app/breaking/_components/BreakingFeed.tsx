"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { BreakingHeadline, BreakingSource } from "@/lib/types";
import { FilterControls, type FilterMode } from "./FilterControls";

const SOURCE_LABEL: Record<BreakingSource, string> = {
  fed:   "Fed",
  ecb:   "ECB",
  wsj:   "WSJ",
  yahoo: "Yahoo",
};

const CATEGORY_LABEL: Record<NonNullable<BreakingHeadline["category"]>, string> = {
  fed:   "Fed",
  macro: "Macro",
  geo:   "Geo",
  corp:  "Corp",
  noise: "Noise",
};

function impactClasses(score: number | null): string {
  if (score == null)        return "bg-zinc-800/60 text-zinc-400";
  if (score >= 9)           return "bg-red-500/20 text-red-300 border-red-500/40";
  if (score >= 7)           return "bg-orange-500/20 text-orange-300 border-orange-500/40";
  if (score >= 5)           return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  if (score >= 3)           return "bg-zinc-700/40 text-zinc-300 border-zinc-700/60";
  return "bg-zinc-800/40 text-zinc-500 border-zinc-800/60";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function applyFilter(rows: BreakingHeadline[], mode: FilterMode): BreakingHeadline[] {
  // Always hide noise unless mode=all
  if (mode === "all")     return rows;
  if (mode === "impact5") return rows.filter(r => (r.impact_score ?? 0) >= 5);
  if (mode === "macro")   return rows.filter(r => r.category === "fed" || r.category === "macro");
  return rows;
}

function mergeRows(prev: BreakingHeadline[], incoming: BreakingHeadline): BreakingHeadline[] {
  const idx = prev.findIndex(r => r.id === incoming.id);
  if (idx === -1) return [incoming, ...prev].slice(0, 200);
  const next = prev.slice();
  next[idx] = incoming;
  return next;
}

export function BreakingFeed({ initial }: { initial: BreakingHeadline[] }) {
  const [rows, setRows] = useState<BreakingHeadline[]>(initial);
  const [mode, setMode] = useState<FilterMode>("impact5");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("breaking_headlines_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "breaking_headlines" },
        (payload) => setRows(prev => mergeRows(prev, payload.new as BreakingHeadline)),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "breaking_headlines" },
        (payload) => setRows(prev => mergeRows(prev, payload.new as BreakingHeadline)),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const visible = useMemo(() => {
    const filtered = applyFilter(rows, mode);
    // sort: impact desc (nulls last), then published desc
    return filtered.sort((a, b) => {
      const ai = a.impact_score ?? -1;
      const bi = b.impact_score ?? -1;
      if (ai !== bi) return bi - ai;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });
  }, [rows, mode]);

  return (
    <>
      <FilterControls mode={mode} onChange={setMode} total={rows.length} shown={visible.length} />

      <ul className="mt-3 divide-y divide-[var(--color-border)] rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
        {visible.map(row => {
          const isOpen = expanded === row.id;
          return (
            <li key={row.id} className="px-3 py-2.5">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : row.id)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span
                  className={
                    "inline-flex h-6 min-w-[34px] shrink-0 items-center justify-center rounded border px-1 font-mono text-[11px] " +
                    impactClasses(row.impact_score)
                  }
                  title={row.classifier_reason ?? undefined}
                >
                  {row.impact_score ?? "—"}
                </span>

                <span className="shrink-0 rounded bg-zinc-800/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300">
                  {SOURCE_LABEL[row.source_name]}
                </span>

                {row.category && (
                  <span className="hidden shrink-0 rounded bg-zinc-900/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-mute)] md:inline-block">
                    {CATEGORY_LABEL[row.category]}
                  </span>
                )}

                <span className="flex-1 text-[13px] leading-snug">
                  {row.headline}
                </span>

                <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--color-text-mute)]">
                  {relativeTime(row.published_at)}
                </span>
              </button>

              {isOpen && (
                <div className="mt-2 ml-[42px] space-y-2 border-l-2 border-[var(--color-border)] pl-3 text-[12px]">
                  {row.ai_enriched ? (
                    <>
                      {row.ai_verified === false && (
                        <div className="inline-block rounded bg-red-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-red-300">
                          Unverified by tier-1 sources
                        </div>
                      )}
                      {row.summary && (
                        <p className="leading-relaxed">{row.summary}</p>
                      )}
                      {row.market_implication && (
                        <div className="rounded border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5">
                          <span className="mr-1 text-[10px] uppercase tracking-wider text-amber-400/80">
                            Implication:
                          </span>
                          <span>{row.market_implication}</span>
                        </div>
                      )}
                      {row.affected_symbols && row.affected_symbols.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">
                            Affects:
                          </span>
                          {row.affected_symbols.map(sym => (
                            <span
                              key={sym}
                              className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px]"
                            >
                              {sym}
                            </span>
                          ))}
                        </div>
                      )}
                      {row.ai_confidence && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">
                          confidence: {row.ai_confidence}
                        </span>
                      )}
                    </>
                  ) : (
                    <p className="text-[var(--color-text-mute)]">
                      {row.impact_score == null
                        ? "Classifier pending…"
                        : (row.impact_score < 5
                            ? "Low impact — no AI verification."
                            : "AI verification pending…")}
                    </p>
                  )}
                  {row.source_url && (
                    <a
                      href={row.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-[11px] text-[var(--color-text-dim)] underline hover:text-zinc-100"
                    >
                      Open source ↗
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
