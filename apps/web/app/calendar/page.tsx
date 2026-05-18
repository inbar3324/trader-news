import { CalendarTable } from "./_components/CalendarTable";
import { FilterBar } from "./_components/FilterBar";
import { MOCK_EVENTS } from "@/lib/mock-events";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { CalendarEvent, CurrencyCode, ImpactLevel } from "@/lib/types";

export const revalidate = 300;

type SearchParams = Promise<{ currency?: string; impact?: string; range?: string }>;

function rangeToWindow(range: string | undefined): { from: Date; to: Date } {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  if (range === "today") {
    const end = new Date(startOfToday);
    end.setUTCDate(end.getUTCDate() + 1);
    return { from: startOfToday, to: end };
  }
  if (range === "next") {
    const start = new Date(startOfToday);
    start.setUTCDate(start.getUTCDate() + 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { from: start, to: end };
  }
  // default: this week
  const end = new Date(startOfToday);
  end.setUTCDate(end.getUTCDate() + 7);
  return { from: startOfToday, to: end };
}

function filterEvents(
  events: CalendarEvent[],
  currencies: Set<string>,
  impacts: Set<string>,
  window: { from: Date; to: Date },
): CalendarEvent[] {
  return events.filter((e) => {
    const t = new Date(e.release_at);
    if (t < window.from || t >= window.to) return false;
    if (currencies.size > 0 && !currencies.has(e.currency)) return false;
    if (impacts.size > 0 && !impacts.has(e.impact)) return false;
    return true;
  });
}

async function fetchEvents(window: { from: Date; to: Date }): Promise<{
  events: CalendarEvent[];
  source: "supabase" | "mock";
}> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { events: MOCK_EVENTS, source: "mock" };

  const { data, error } = await supabase
    .from("events")
    .select(
      `id, event_type_id, title, release_at, impact, currency, source, source_ref,
       event_occurrences ( actual, forecast, previous ),
       event_types ( slug )`,
    )
    .gte("release_at", window.from.toISOString())
    .lt("release_at", window.to.toISOString())
    .order("release_at", { ascending: true })
    .limit(500);

  if (error || !data) return { events: MOCK_EVENTS, source: "mock" };

  const events: CalendarEvent[] = data.map((row: Record<string, unknown>) => {
    const occ = (row.event_occurrences ?? null) as
      | { actual: number | null; forecast: number | null; previous: number | null }
      | null;
    const type = (row.event_types ?? null) as { slug: string | null } | null;
    return {
      id: row.id as string,
      event_type_id: (row.event_type_id ?? null) as string | null,
      title: row.title as string,
      release_at: row.release_at as string,
      impact: row.impact as ImpactLevel,
      currency: row.currency as CurrencyCode,
      source: row.source as string,
      source_ref: (row.source_ref ?? null) as string | null,
      actual: occ?.actual ?? null,
      forecast: occ?.forecast ?? null,
      previous: occ?.previous ?? null,
      event_type_slug: type?.slug ?? null,
    };
  });

  return { events, source: "supabase" };
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const currencies = new Set((sp.currency ?? "").split(",").filter(Boolean));
  const impacts = new Set((sp.impact ?? "").split(",").filter(Boolean));
  const window = rangeToWindow(sp.range);

  const { events, source } = await fetchEvents(window);
  const filtered = filterEvents(events, currencies, impacts, window);

  return (
    <div className="mx-auto max-w-[1400px]">
      <FilterBar />
      {source === "mock" && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-200">
          Showing mock data — Supabase env vars not set. Add them to <code className="font-mono">.env.local</code> and run the <code className="font-mono">pull-calendar</code> worker.
        </div>
      )}
      <CalendarTable events={filtered} />
    </div>
  );
}
