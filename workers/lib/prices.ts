// yfinance 1-min bar adapter via yahoo-finance2.
// Fetches OHLCV bars for a ±window around a given timestamp.
// Only works for data within the last ~30 trading days (yfinance limitation).

import yahooFinance from "yahoo-finance2";

export interface PriceBar {
  symbol: string;
  ts: string;  // UTC ISO
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Fetch 1-min bars for yfSymbol in [from, to].
// Returns [] if no data (market closed, too old, bad symbol).
// Returns null if Yahoo rate-limited (429) — caller should bail out early.
// On first 429, retries once after 8s; if still 429, returns null.
export async function fetch1mBars(
  yfSymbol: string,
  ticker: string,
  from: Date,
  to: Date,
  attempt = 1,
): Promise<PriceBar[] | null> {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json",
  };
  const cookieHeader = process.env.YAHOO_COOKIE;
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  const moduleOpts = { validateResult: false as const, fetchOptions: { headers } };

  try {
    const result = await yahooFinance.chart(yfSymbol, {
      period1: from,
      period2: to,
      interval: "1m",
    }, moduleOpts);

    const quotes = result?.quotes ?? [];
    const bars: PriceBar[] = [];
    for (const q of quotes) {
      if (!q.date || q.close == null) continue;
      bars.push({
        symbol: ticker,
        ts: new Date(q.date).toISOString(),
        open: q.open ?? q.close,
        high: q.high ?? q.close,
        low: q.low ?? q.close,
        close: q.close,
        volume: q.volume ?? 0,
      });
    }
    return bars;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes("Too Many Requests") || msg.includes("429");
    if (is429 && attempt === 1) {
      console.warn(`  [prices] 429 for ${yfSymbol} — retrying in 8s`);
      await sleep(8_000);
      return fetch1mBars(yfSymbol, ticker, from, to, 2);
    }
    if (is429) {
      console.warn(`  [prices] 429 for ${yfSymbol} — rate-limited (signalling caller)`);
      return null;
    }
    console.warn(`  [prices] fetch error for ${yfSymbol}: ${msg}`);
    return [];
  }
}

// Fetch bars for ±windowMinutes around releaseAt.
// Returns null if Yahoo rate-limited — caller should stop iterating.
export async function fetchBarsAroundEvent(
  yfSymbol: string,
  ticker: string,
  releaseAt: Date,
  windowMinutes = 120,
): Promise<PriceBar[] | null> {
  const from = new Date(releaseAt.getTime() - windowMinutes * 60_000);
  const to   = new Date(releaseAt.getTime() + windowMinutes * 60_000);
  return fetch1mBars(yfSymbol, ticker, from, to);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
