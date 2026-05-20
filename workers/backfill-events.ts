// Seed deterministic past events (last ~30 days) for known recurring event_types.
// Closes the gap left by FairEconomy's thisweek-only feed so that:
//   1. backfill-bars has events to fetch yfinance bars for, and
//   2. recompute-reactions can reach sample_size >= 3 on weekly events.
//
// Idempotent — re-runs are no-ops (upsert on source,source_ref).
// Skips any synthetic slot already covered by a real faireconomy event (±2h).
//
// Run:    npm --workspace workers run backfill-events
// Filter: npm --workspace workers run backfill-events -- --slug=us-jobless-claims

import { getServiceClient } from "./lib/supabase.js";
import { localToUtc } from "./lib/local-time.js";

type Cadence =
  | "weekly"
  | "first-business-day"
  | "third-business-day"
  | "first-friday";

interface ScheduleEntry {
  slug: string;
  cadence: Cadence;
  dayOfWeek?: number; // 0=Sun, 4=Thu (weekly only)
  hour: number;
  minute: number;
  timezone: string;
}

const SCHEDULES: ScheduleEntry[] = [
  { slug: "us-jobless-claims",     cadence: "weekly",              dayOfWeek: 4, hour: 8,  minute: 30, timezone: "America/New_York" },
  { slug: "us-nfp",                cadence: "first-friday",                       hour: 8,  minute: 30, timezone: "America/New_York" },
  { slug: "us-unemployment-rate",  cadence: "first-friday",                       hour: 8,  minute: 30, timezone: "America/New_York" },
  { slug: "us-ism-manufacturing",  cadence: "first-business-day",                 hour: 10, minute: 0,  timezone: "America/New_York" },
  { slug: "us-ism-services",       cadence: "third-business-day",                 hour: 10, minute: 0,  timezone: "America/New_York" },
];

// US federal market holidays 2025-2026 (NYSE-observed dates). Used only to skip
// jobless-claims releases that fall on a holiday (rare).
const US_HOLIDAYS = new Set<string>([
  "2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26",
  "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
]);

function isHoliday(d: Date): boolean {
  return US_HOLIDAYS.has(d.toISOString().slice(0, 10));
}

function isBusinessDay(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow >= 1 && dow <= 5 && !isHoliday(d);
}

function nthBusinessDayOfMonth(year: number, month: number, n: number): Date | null {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1) return null;
    if (isBusinessDay(d)) {
      count++;
      if (count === n) return d;
    }
  }
  return null;
}

function firstFridayOfMonth(year: number, month: number): Date | null {
  for (let day = 1; day <= 7; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCDay() === 5) return d;
  }
  return null;
}

function generateDates(entry: ScheduleEntry, fromUtc: Date, toUtc: Date): Date[] {
  const dates: Date[] = [];

  if (entry.cadence === "weekly") {
    const cursor = new Date(fromUtc);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= toUtc) {
      if (cursor.getUTCDay() === entry.dayOfWeek && !isHoliday(cursor)) {
        dates.push(new Date(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    const cursor = new Date(Date.UTC(fromUtc.getUTCFullYear(), fromUtc.getUTCMonth(), 1));
    while (cursor <= toUtc) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth() + 1;
      let d: Date | null = null;
      if (entry.cadence === "first-business-day") d = nthBusinessDayOfMonth(y, m, 1);
      else if (entry.cadence === "third-business-day") d = nthBusinessDayOfMonth(y, m, 3);
      else if (entry.cadence === "first-friday") d = firstFridayOfMonth(y, m);
      if (d && d >= fromUtc && d <= toUtc) dates.push(d);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  return dates;
}

function stableKey(currency: string, releaseAt: string, slug: string): string {
  return `synthetic:${currency}:${releaseAt}:${slug}`;
}

async function main() {
  const slugFilter = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];
  const sb = getServiceClient();

  const { data: typesData, error: typesErr } = await sb
    .from("event_types")
    .select("id, slug, display_name, currency, default_impact");
  if (typesErr) throw typesErr;
  const types = (typesData ?? []) as Array<{
    id: string;
    slug: string;
    display_name: string;
    currency: string;
    default_impact: string;
  }>;
  const typeBySlug = new Map(types.map((t) => [t.slug, t]));

  // Window: 35 days ago → 7 days ago. The last week is FairEconomy's territory.
  const now = new Date();
  const fromUtc = new Date(now.getTime() - 35 * 24 * 3600_000);
  const toUtc = new Date(now.getTime() - 7 * 24 * 3600_000);

  console.log(
    `[backfill-events] window: ${fromUtc.toISOString().slice(0, 10)} → ${toUtc.toISOString().slice(0, 10)}`,
  );

  const rows: Array<{
    event_type_id: string;
    title: string;
    release_at: string;
    impact: string;
    currency: string;
    source: string;
    source_ref: string;
  }> = [];

  for (const entry of SCHEDULES) {
    if (slugFilter && entry.slug !== slugFilter) continue;
    const type = typeBySlug.get(entry.slug);
    if (!type) {
      console.warn(`  ${entry.slug}: not in event_types — skipping`);
      continue;
    }
    const dates = generateDates(entry, fromUtc, toUtc);
    for (const d of dates) {
      const utc = localToUtc(
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
        entry.hour,
        entry.minute,
        entry.timezone,
      );
      const releaseAt = utc.toISOString();
      rows.push({
        event_type_id: type.id,
        title: `[backfill] ${type.display_name}`,
        release_at: releaseAt,
        impact: type.default_impact,
        currency: type.currency,
        source: "backfill-synthetic",
        source_ref: stableKey(type.currency, releaseAt, entry.slug),
      });
    }
    console.log(`  ${entry.slug}: ${dates.length} dates`);
  }

  if (rows.length === 0) {
    console.log("[backfill-events] nothing to insert");
    return;
  }

  // Skip synthetic rows already covered by a real faireconomy event (±2h same event_type).
  const filtered: typeof rows = [];
  for (const r of rows) {
    const rAt = new Date(r.release_at);
    const lo = new Date(rAt.getTime() - 2 * 3600_000).toISOString();
    const hi = new Date(rAt.getTime() + 2 * 3600_000).toISOString();
    const { count } = await sb
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("event_type_id", r.event_type_id)
      .gte("release_at", lo)
      .lte("release_at", hi)
      .neq("source", "backfill-synthetic");
    if ((count ?? 0) > 0) continue;
    filtered.push(r);
  }

  console.log(
    `[backfill-events] ${filtered.length} to upsert (${rows.length - filtered.length} skipped — overlap with faireconomy)`,
  );

  if (filtered.length === 0) {
    console.log("[backfill-events] done ✓");
    return;
  }

  const { error: upErr, count } = await sb
    .from("events")
    .upsert(filtered, { onConflict: "source,source_ref", count: "exact" });
  if (upErr) throw upErr;
  console.log(`[backfill-events] upserted ${count ?? filtered.length} events ✓`);
}

main().catch((err) => {
  console.error("[backfill-events] FAILED:", err);
  process.exit(1);
});
