import { CalendarTable } from "./_components/CalendarTable";
import { CalendarSidebar } from "./_components/CalendarSidebar";
import { FilterBar } from "./_components/FilterBar";
import { KeyboardNav } from "./_components/KeyboardNav";
import { DataSourceBanner } from "./_components/DataSourceBanner";
import { MOCK_EVENTS } from "@/lib/mock-events";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { CalendarEvent, CurrencyCode, ImpactLevel } from "@/lib/types";

export const revalidate = 300;

type SearchParams = Promise<{
  currency?: string;
  impact?: string;
  range?: string;
  q?: string;
  d?: string;
}>;

const NY_TZ = "America/New_York";

function ymdToNYStart(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Approximate: treat the date's start in NY by using UTC midnight minus NY offset.
  // For UI filtering this is close enough since events have ISO timestamps with offset.
  // Use a 12pm UTC anchor so DST flips don't slip the day.
  const anchor = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const nyMidnight = new Date(
    anchor.toLocaleString("en-US", { timeZone: NY_TZ }),
  );
  nyMidnight.setHours(0, 0, 0, 0);
  return nyMidnight;
}

function rangeToWindow(range: string | undefined, dayParam: string | undefined): { from: Date; to: Date } {
  if (dayParam) {
    const start = ymdToNYStart(dayParam);
    if (start) {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { from: start, to: end };
    }
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  // Sunday at-or-before today (US/ForexFactory calendar week convention).
  const startOfThisWeek = new Date(startOfToday);
  startOfThisWeek.setUTCDate(startOfThisWeek.getUTCDate() - startOfThisWeek.getUTCDay());

  if (range === "today") {
    const end = new Date(startOfToday);
    end.setUTCDate(end.getUTCDate() + 1);
    return { from: startOfToday, to: end };
  }
  if (range === "tomorrow") {
    const start = new Date(startOfToday);
    start.setUTCDate(start.getUTCDate() + 1);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { from: start, to: end };
  }
  if (range === "last") {
    const start = new Date(startOfThisWeek);
    start.setUTCDate(start.getUTCDate() - 7);
    const end = new Date(startOfThisWeek);
    return { from: start, to: end };
  }
  if (range === "next") {
    const start = new Date(startOfThisWeek);
    start.setUTCDate(start.getUTCDate() + 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { from: start, to: end };
  }
  if (range === "next2" || range === "next3" || range === "next4") {
    const weeks = range === "next2" ? 2 : range === "next3" ? 3 : 4;
    const start = new Date(startOfThisWeek);
    start.setUTCDate(start.getUTCDate() + 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7 * weeks);
    return { from: start, to: end };
  }
  if (range === "month") {
    const start = new Date(startOfThisWeek);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 28);
    return { from: start, to: end };
  }
  // default: this week (Sunday → next Sunday)
  const end = new Date(startOfThisWeek);
  end.setUTCDate(end.getUTCDate() + 7);
  return { from: startOfThisWeek, to: end };
}

function filterEvents(
  events: CalendarEvent[],
  currencies: Set<string>,
  impacts: Set<string>,
  window: { from: Date; to: Date },
  query: string,
): CalendarEvent[] {
  return events.filter((e) => {
    const t = new Date(e.release_at);
    if (t < window.from || t >= window.to) return false;
    if (currencies.size > 0 && !currencies.has(e.currency)) return false;
    if (impacts.size > 0 && !impacts.has(e.impact)) return false;
    if (query && !e.title.toLowerCase().includes(query)) return false;
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
    .limit(2000);

  if (error || !data) return { events: MOCK_EVENTS, source: "mock" };

  const events: CalendarEvent[] = data.map((row: Record<string, unknown>) => {
    const rawOcc = row.event_occurrences ?? null;
    const occ = (Array.isArray(rawOcc) ? rawOcc[0] ?? null : rawOcc) as
      | { actual: number | null; forecast: number | null; previous: number | null }
      | null;
    const rawType = row.event_types ?? null;
    const type = (Array.isArray(rawType) ? rawType[0] ?? null : rawType) as
      | { slug: string | null }
      | null;
    const occObj = occ as Record<string, unknown> | null;
    const actualVal = occObj && "actual" in occObj ? (occObj.actual as number | null) : null;
    const forecastVal = occObj && "forecast" in occObj ? (occObj.forecast as number | null) : null;
    const previousVal = occObj && "previous" in occObj ? (occObj.previous as number | null) : null;
    return {
      id: row.id as string,
      event_type_id: (row.event_type_id ?? null) as string | null,
      title: row.title as string,
      release_at: row.release_at as string,
      impact: row.impact as ImpactLevel,
      currency: row.currency as CurrencyCode,
      source: row.source as string,
      source_ref: (row.source_ref ?? null) as string | null,
      actual: actualVal,
      forecast: forecastVal,
      previous: previousVal,
      event_type_slug: type?.slug ?? null,
    };
  });

  return { events, source: "supabase" };
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const currencies = new Set((sp.currency ?? "").split(",").filter(Boolean));
  const impacts = new Set((sp.impact ?? "").split(",").filter(Boolean));
  const query = (sp.q ?? "").toLowerCase().trim();
  const window = rangeToWindow(sp.range, sp.d);

  const { events, source } = await fetchEvents(window);
  const filtered = filterEvents(events, currencies, impacts, window, query);

  return (
    <div className="mx-auto max-w-[1600px]">
      <DataSourceBanner source={source} />
      <div className="lg:flex">
        <CalendarSidebar />
        <div className="min-w-0 flex-1">
          <FilterBar />
          <KeyboardNav />
          <CalendarTable events={filtered} />
        </div>
      </div>
    </div>
  );
}
