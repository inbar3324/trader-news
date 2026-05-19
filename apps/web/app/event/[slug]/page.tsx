import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { MOCK_EVENTS } from "@/lib/mock-events";
import { formatDayHeaderNY, formatNumber, formatTimeNY, impactDotColor } from "@/lib/formatters";
import type { HistoricalReaction, Symbol } from "@/lib/types";
import { ReactionStats } from "./_components/ReactionStats";
import { VolScoreGauge } from "./_components/VolScoreGauge";
import { WatchButton } from "./_components/WatchButton";
import { AIExplainer } from "./_components/AIExplainer";

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

interface EventData {
  id: string;
  event_type_id: string;
  title: string;
  release_at: string;
  impact: string;
  currency: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
}

async function fetchEventData(slug: string): Promise<{
  event: EventData;
  reactions: HistoricalReaction[];
  symbols: Symbol[];
  volScore: number | null;
  watching: boolean;
} | null> {
  const supabase = await getSupabaseServer();

  if (!supabase) {
    // Mock fallback
    const mock = MOCK_EVENTS.find((e) => e.event_type_slug === slug);
    if (!mock) return null;
    return {
      event: { ...mock, event_type_id: mock.event_type_id ?? "" },
      reactions: [],
      symbols: [],
      volScore: null,
      watching: false,
    };
  }

  // Fetch event + occurrences via event_type slug
  const { data: evData, error: evErr } = await supabase
    .from("events")
    .select(`
      id, event_type_id, title, release_at, impact, currency,
      event_types!inner( slug ),
      event_occurrences( actual, forecast, previous )
    `)
    .eq("event_types.slug", slug)
    .order("release_at", { ascending: false })
    .limit(1)
    .single();

  if (evErr || !evData) return null;

  const occ = Array.isArray(evData.event_occurrences)
    ? (evData.event_occurrences[0] as { actual: number | null; forecast: number | null; previous: number | null } | undefined) ?? null
    : (evData.event_occurrences as { actual: number | null; forecast: number | null; previous: number | null } | null);
  const event: EventData = {
    id: evData.id as string,
    event_type_id: evData.event_type_id as string,
    title: evData.title as string,
    release_at: evData.release_at as string,
    impact: evData.impact as string,
    currency: evData.currency as string,
    actual: occ?.actual ?? null,
    forecast: occ?.forecast ?? null,
    previous: occ?.previous ?? null,
  };

  // Fetch historical reactions for this event_type
  const { data: rxData } = await supabase
    .from("historical_reactions")
    .select("*")
    .eq("event_type_id", event.event_type_id);

  const reactions = (rxData ?? []) as HistoricalReaction[];

  // Fetch symbols for the tickers we have reactions for
  const tickers = reactions.map((r) => r.symbol);
  const { data: symData } = tickers.length > 0
    ? await supabase.from("symbols").select("*").in("ticker", tickers)
    : { data: [] };

  const symbols = (symData ?? []) as Symbol[];

  // vol_score — use the SPY reaction if available, else first available
  const volScore =
    reactions.find((r) => r.symbol === "SPY")?.vol_score ??
    reactions[0]?.vol_score ??
    null;

  // Check if current user is watching this event_type
  const { data: { user } } = await supabase.auth.getUser();
  let watching = false;
  if (user && event.event_type_id) {
    const { data: wl } = await supabase
      .from("watchlists")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_type_id", event.event_type_id)
      .maybeSingle();
    watching = !!wl;
  }

  return { event, reactions, symbols, volScore, watching };
}

export default async function EventDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const data = await fetchEventData(slug);
  if (!data) notFound();

  const { event, reactions, symbols, volScore, watching } = data;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <a
        href="/calendar"
        className="text-[11px] uppercase tracking-wider text-[var(--color-text-mute)] hover:text-[var(--color-text-dim)]"
      >
        ← Calendar
      </a>

      <header className="mt-3 flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-text-dim)]">
            <span className={`inline-block h-2 w-2 rounded-full ${impactDotColor(event.impact as never)}`} />
            <span className="font-mono text-[12px]">{event.currency}</span>
            <span>·</span>
            <span className="text-[12px]">
              {formatDayHeaderNY(event.release_at)} {formatTimeNY(event.release_at)} ET
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
            {event.event_type_id && (
              <WatchButton eventTypeId={event.event_type_id} watching={watching} />
            )}
          </div>
        </div>

        {volScore != null ? (
          <div className="w-[180px] shrink-0">
            <VolScoreGauge score={volScore} />
          </div>
        ) : (
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">Vol score</div>
            <div className="text-2xl font-semibold text-[var(--color-text-dim)]">—/10</div>
            <div className="text-[10px] text-[var(--color-text-mute)]">need data</div>
          </div>
        )}
      </header>

      {/* Actual / Forecast / Previous */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Actual" value={formatNumber(event.actual)} highlight />
        <StatCard label="Forecast" value={formatNumber(event.forecast)} />
        <StatCard label="Previous" value={formatNumber(event.previous)} muted />
      </div>

      {/* AI Explainer */}
      <section className="mt-6">
        <h2 className="text-[11px] uppercase tracking-wider text-[var(--color-text-mute)]">
          AI explainer
        </h2>
        <div className="mt-2">
          <AIExplainer eventId={event.id} />
        </div>
      </section>

      {/* Historical reaction */}
      <section className="mt-6">
        <h2 className="text-[11px] uppercase tracking-wider text-[var(--color-text-mute)]">
          Historical reaction
        </h2>
        <div className="mt-2">
          <ReactionStats reactions={reactions} symbols={symbols} />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-mute)]">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold ${
          highlight ? "" : muted ? "text-[var(--color-text-mute)]" : "text-[var(--color-text-dim)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
