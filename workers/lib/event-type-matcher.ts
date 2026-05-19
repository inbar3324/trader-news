// Match a FairEconomy event title to an event_types row.
// Shared by pull-calendar (new events) and match-events (re-match historical).

export interface EventTypeRow {
  id: string;
  slug: string;
  display_name: string;
  currency: string;
}

// Country prefixes we strip from display_name before comparing — these duplicate
// the `currency` filter and break substring matches. Sub-region prefixes like
// "German"/"French" are kept because they distinguish event_types within the
// same currency.
const COUNTRY_PREFIXES = ["us", "uk", "eu", "ca", "au", "jp", "gb"];

// FF uses different wording than our seed for a few canonical events.
const TITLE_ALIASES: Record<string, string> = {
  "unemployment claims": "initial jobless claims",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bm\/m\b/g, "mom")
    .replace(/\by\/y\b/g, "yoy")
    .replace(/\bq\/q\b/g, "qoq")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripCountryPrefix(normalized: string): string {
  for (const p of COUNTRY_PREFIXES) {
    if (normalized.startsWith(p + " ")) return normalized.slice(p.length + 1);
  }
  return normalized;
}

function aliasOf(normalized: string): string {
  return TITLE_ALIASES[normalized] ?? normalized;
}

function scorePair(ffNorm: string, displayNorm: string): number {
  const a = aliasOf(ffNorm);
  const b = displayNorm;
  if (a === b) return 100;
  if (b.includes(a)) {
    const extra = b.split(" ").length - a.split(" ").length;
    return Math.max(50, 80 - extra * 10);
  }
  if (a.includes(b)) {
    const extra = a.split(" ").length - b.split(" ").length;
    return Math.max(50, 75 - extra * 10);
  }
  const tt = new Set(a.split(" ").filter(Boolean));
  const nt = new Set(b.split(" ").filter(Boolean));
  let overlap = 0;
  for (const w of tt) if (nt.has(w)) overlap++;
  const denom = Math.max(nt.size, tt.size);
  return (overlap / denom) * 70;
}

export function matchEventType(
  ffTitle: string,
  ffCurrency: string,
  types: EventTypeRow[],
): EventTypeRow | null {
  const a = normalize(ffTitle);
  const candidates = types.filter((x) => x.currency === ffCurrency);
  let best: EventTypeRow | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const b = stripCountryPrefix(normalize(c.display_name));
    const s = scorePair(a, b);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return bestScore >= 60 ? best : null;
}
