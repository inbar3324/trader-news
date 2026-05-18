// Fetch & normalize the FairEconomy (unofficial Forex Factory) calendar feed.
// Docs: https://faireconomy.media/

export type FFImpact = "Holiday" | "Low" | "Medium" | "High";

export interface FFEvent {
  title: string;
  country: string;       // 'USD','EUR','GBP','JPY','AUD','CAD','CHF','NZD'
  date: string;          // ISO 8601 with timezone
  impact: FFImpact;
  forecast: string;
  previous: string;
  actual?: string;       // populated after event releases
}

const DEFAULT_URL =
  process.env.FAIRECONOMY_URL ?? "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

const UA =
  "Mozilla/5.0 (TraderNews/0.1; +https://github.com/tradernews) calendar-sync";

export async function fetchFairEconomyWeek(url = DEFAULT_URL): Promise<FFEvent[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`FairEconomy fetch failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) {
    throw new Error("FairEconomy response is not an array");
  }
  return json as FFEvent[];
}

const IMPACT_MAP: Record<FFImpact, "low" | "medium" | "high" | "holiday"> = {
  Holiday: "holiday",
  Low: "low",
  Medium: "medium",
  High: "high",
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
  source: string;         // 'faireconomy'
  source_ref: string;     // hash key for dedupe
}

function parseNumeric(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,%KMB$€£¥]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function stableKey(title: string, currency: string, releaseAt: string): string {
  // Deterministic dedupe key — same event reposted = same key
  return `ff:${currency}:${releaseAt}:${title.toLowerCase().replace(/\s+/g, "-")}`;
}

export function normalize(events: FFEvent[]): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  for (const e of events) {
    if (!e || !e.date || !e.country || !e.title) continue;
    if (!ALLOWED_CCY.has(e.country)) continue;
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const releaseAt = d.toISOString();
    out.push({
      title: e.title.trim(),
      currency: e.country,
      release_at: releaseAt,
      impact: IMPACT_MAP[e.impact] ?? "low",
      actual: parseNumeric(e.actual),
      forecast: parseNumeric(e.forecast),
      previous: parseNumeric(e.previous),
      source: "faireconomy",
      source_ref: stableKey(e.title, e.country, releaseAt),
    });
  }
  return out;
}
