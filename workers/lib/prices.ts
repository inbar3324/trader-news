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
// Returns empty array if no data available (older than 30 days, bad symbol, etc.)
export async function fetch1mBars(
  yfSymbol: string,
  ticker: string,
  from: Date,
  to: Date,
): Promise<PriceBar[]> {
  try {
    const result = await yahooFinance.chart(yfSymbol, {
      period1: from,
      period2: to,
      interval: "1m",
    }, { validateResult: false });

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
  } catch {
    return [];
  }
}

// Fetch bars for ±windowMinutes around releaseAt.
export async function fetchBarsAroundEvent(
  yfSymbol: string,
  ticker: string,
  releaseAt: Date,
  windowMinutes = 120,
): Promise<PriceBar[]> {
  const from = new Date(releaseAt.getTime() - windowMinutes * 60_000);
  const to   = new Date(releaseAt.getTime() + windowMinutes * 60_000);
  return fetch1mBars(yfSymbol, ticker, from, to);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
