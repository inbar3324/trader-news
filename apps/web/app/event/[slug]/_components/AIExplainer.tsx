import { getSupabaseServer } from "@/lib/supabase/server";

interface ExplainerOutput {
  what: string;
  why_it_matters: string;
  agenda_or_topics: string;
  consensus_expectation: string;
  bullish_scenario: string;
  bearish_scenario: string;
  impacted_symbols: string[];
  watch_for: string;
}

export async function AIExplainer({ eventId }: { eventId: string }) {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;

  const { data } = await supabase
    .from("ai_enrichments")
    .select("payload, created_at, expires_at")
    .eq("event_id", eventId)
    .eq("kind", "explainer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return (
      <div className="rounded border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[13px] text-[var(--color-text-mute)]">
        AI summary pending — runs hourly. Refresh after the next scheduled enrichment.
      </div>
    );
  }

  const p = data.payload as ExplainerOutput;
  const isStale = new Date(data.expires_at as string) < new Date();

  return (
    <div className="space-y-3">
      {isStale && (
        <p className="text-[11px] text-[var(--color-text-mute)]">
          Last refreshed: {new Date(data.created_at as string).toLocaleDateString()} — AI updates resume shortly.
        </p>
      )}

      {/* What + Why it matters */}
      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2">
        <p className="text-[13px] leading-relaxed">{p.what}</p>
        <p className="text-[13px] leading-relaxed text-[var(--color-text-dim)]">{p.why_it_matters}</p>
      </div>

      {/* Consensus chip */}
      {p.consensus_expectation && (
        <div className="inline-flex items-center gap-2 rounded bg-zinc-800/80 px-3 py-1.5 font-mono">
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">Street:</span>
          <span className="text-[12px]">{p.consensus_expectation}</span>
        </div>
      )}

      {/* Agenda / topics (speeches only — data releases use "N/A") */}
      {p.agenda_or_topics && p.agenda_or_topics !== "N/A" && (
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">
            Likely topics
          </div>
          <p className="text-[13px] leading-relaxed">{p.agenda_or_topics}</p>
        </div>
      )}

      {/* Bull / Bear scenarios */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded border border-green-500/30 bg-green-500/5 p-4">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-green-400/80">Bullish</div>
          <p className="text-[13px] leading-relaxed">{p.bullish_scenario}</p>
        </div>
        <div className="rounded border border-red-500/30 bg-red-500/5 p-4">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-red-400/80">Bearish</div>
          <p className="text-[13px] leading-relaxed">{p.bearish_scenario}</p>
        </div>
      </div>

      {/* Impacted symbols */}
      {p.impacted_symbols?.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">Watching:</span>
          {p.impacted_symbols.map((sym) => (
            <span
              key={sym}
              className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[12px]"
            >
              {sym}
            </span>
          ))}
        </div>
      )}

      {/* Watch for */}
      {p.watch_for && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <span className="text-[10px] uppercase tracking-wider text-amber-400/80">Watch for: </span>
          <span className="text-[13px]">{p.watch_for}</span>
        </div>
      )}
    </div>
  );
}
