// Fetch & normalize the ForexFactory calendar by extracting the embedded
// `window.calendarComponentStates[1]` JSON from the public calendar HTML page.
//
// Why this and not the FairEconomy JSON: FairEconomy's free feed stopped
// including the `actual` field, so ACTUAL values were never populated.
// FF's own page embeds the full data (incl. actuals + revisions) and supports
// arbitrary week navigation, so we can also see weeks beyond "this week".

export type FFImpactName = "low" | "medium" | "high" | "holiday";

export interface FFRawEvent {
  id: number;
  name: string;
  dateline: number; // unix seconds, UTC
  currency: string;
  country: string;
  impactName: FFImpactName | string;
  actual: string;
  forecast: string;
  previous: string;
  revision: string;
  leaked?: boolean;
}

interface FFCalendarState {
  days: Array<{ events?: FFRawEvent[] }>;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

/**
 * Build the FF `?week=` URL parameter for the Monday of `now + weekOffset weeks`.
 * weekOffset=0 → this week, 1 → next week, etc.
 */
export function weekParamForOffset(weekOffset: number, now: Date = new Date()): string {
  // Find Monday of the current ISO week, in UTC.
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - daysFromMonday + weekOffset * 7);
  return `${MONTHS[d.getUTCMonth()]}${d.getUTCDate()}.${d.getUTCFullYear()}`;
}

/**
 * Extract a balanced `{...}` JSON object starting at the first `{` after `startIdx`.
 * Naive but adequate for FF's machine-generated JSON which never contains
 * unescaped braces inside string literals.
 */
function extractBalancedObject(src: string, startIdx: number): string | null {
  const open = src.indexOf("{", startIdx);
  if (open === -1) return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (escape) { escape = false; continue; }
    if (inStr) {
      if (c === "\\") { escape = true; continue; }
      if (c === '"') { inStr = false; continue; }
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

export async function fetchFFWeek(weekParam: string, attempt = 1): Promise<FFRawEvent[]> {
  const url = `https://www.forexfactory.com/calendar?week=${weekParam}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
    },
  });
  if (res.status === 403 || res.status === 429) {
    if (attempt < 3) {
      const wait = 5_000 * attempt;
      console.warn(`[ff] ${res.status} for ${weekParam}, retrying in ${wait}ms (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, wait));
      return fetchFFWeek(weekParam, attempt + 1);
    }
  }
  if (!res.ok) {
    throw new Error(`ForexFactory fetch failed for ${weekParam}: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const marker = "window.calendarComponentStates[1]";
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error(`ForexFactory: ${marker} not found in HTML for ${weekParam}`);
  }
  const jsonText = extractBalancedObject(html, markerIdx + marker.length);
  if (!jsonText) {
    throw new Error(`ForexFactory: could not extract JSON for ${weekParam}`);
  }
  const state = JSON.parse(jsonText) as FFCalendarState;
  if (!state.days) {
    throw new Error(`ForexFactory: parsed JSON has no .days for ${weekParam}`);
  }
  return state.days.flatMap((d) => d.events ?? []);
}

const IMPACT_MAP: Record<string, "low" | "medium" | "high" | "holiday"> = {
  low: "low",
  medium: "medium",
  high: "high",
  holiday: "holiday",
  // FF sometimes uses "nonEconomic" for holidays etc.
  nonEconomic: "holiday",
};

const ALLOWED_CCY = new Set(["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"]);

export interface NormalizedEvent {
  title: string;
  currency: string;
  release_at: string;     // UTC ISO
  impact: "low" | "medium" | "high" | "holiday";
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  source: string;
  source_ref: string;
}

function parseNumeric(raw: string | undefined | null): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/[,%KMB$€£¥]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  // Handle "1.2T" style suffixes if they ever appear
  const m = cleaned.match(/^(-?\d+(?:\.\d+)?)([KMBT])?$/i);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    const mult: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
    return m[2] ? n * mult[m[2].toUpperCase()] : n;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function stableKey(title: string, currency: string, releaseAt: string): string {
  // Same shape as the legacy FairEconomy key, so existing event rows
  // (unique on source+source_ref) dedupe instead of duplicating.
  return `ff:${currency}:${releaseAt}:${title.toLowerCase().replace(/\s+/g, "-")}`;
}

export function normalize(events: FFRawEvent[]): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  for (const e of events) {
    if (!e || !e.name || !e.currency || !e.dateline) continue;
    if (!ALLOWED_CCY.has(e.currency)) continue;
    const releaseAt = new Date(e.dateline * 1000).toISOString();
    const impact = IMPACT_MAP[e.impactName] ?? "low";
    out.push({
      title: e.name.trim(),
      currency: e.currency,
      release_at: releaseAt,
      impact,
      actual: parseNumeric(e.actual),
      // Prefer revised previous if present, fall back to original
      forecast: parseNumeric(e.forecast),
      previous: parseNumeric(e.revision) ?? parseNumeric(e.previous),
      source: "faireconomy",
      source_ref: stableKey(e.name, e.currency, releaseAt),
    });
  }
  return out;
}

/**
 * Fetch multiple weeks (current + future offsets) sequentially with a small
 * delay to stay polite with ForexFactory's edge.
 */
export async function fetchFFWeeks(weekOffsets: number[]): Promise<FFRawEvent[]> {
  const all: FFRawEvent[] = [];
  const seenIds = new Set<number>();
  for (const offset of weekOffsets) {
    const param = weekParamForOffset(offset);
    const events = await fetchFFWeek(param);
    for (const e of events) {
      if (seenIds.has(e.id)) continue;
      seenIds.add(e.id);
      all.push(e);
    }
    if (offset !== weekOffsets[weekOffsets.length - 1]) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return all;
}
