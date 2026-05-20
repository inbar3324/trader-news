// One-off analysis: compare current percentile-based vol_score vs proposed
// absolute-magnitude vol_score grounded in each symbol's typical 5m noise.
// Read-only — does NOT write to DB.
//
// Run: npm --workspace workers run analyze-vol-score

import { getServiceClient } from "./lib/supabase.js";

interface SymbolRow {
  ticker: string;
}
interface BarRow {
  ts: string;
  close: number;
}
interface ReactionRow {
  event_type_id: string;
  symbol: string;
  sample_size: number;
  avg_abs_pct_5m: number | null;
  max_abs_pct_15m: number | null;
  vol_score: number | null;
}
interface EventTypeRow {
  id: string;
  slug: string;
}

async function main() {
  const sb = getServiceClient();

  const { data: symbolsData } = await sb.from("symbols").select("ticker");
  const symbols = (symbolsData ?? []) as SymbolRow[];

  // Compute typical 5m absolute return per symbol from up to 5000 recent bars
  const typical5mBySymbol = new Map<string, number>();
  for (const sym of symbols) {
    const { data: barsData } = await sb
      .from("price_bars_1m")
      .select("ts, close")
      .eq("symbol", sym.ticker)
      .order("ts", { ascending: true })
      .limit(5000);
    const bars = (barsData ?? []) as BarRow[];
    if (bars.length < 100) { typical5mBySymbol.set(sym.ticker, 0); continue; }

    const returns: number[] = [];
    for (let i = 5; i < bars.length; i++) {
      const a = bars[i - 5].close;
      const b = bars[i].close;
      if (!a || a === 0) continue;
      // Only include if these 5 bars are roughly contiguous (within 6 min)
      const dtMs = new Date(bars[i].ts).getTime() - new Date(bars[i - 5].ts).getTime();
      if (dtMs > 7 * 60_000) continue;
      returns.push(Math.abs((b - a) / a));
    }
    if (returns.length === 0) { typical5mBySymbol.set(sym.ticker, 0); continue; }
    const sorted = returns.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    typical5mBySymbol.set(sym.ticker, median);
  }

  console.log("\n=== Typical 5-min |return| per symbol (median across 5000 bars) ===");
  for (const [sym, val] of typical5mBySymbol) {
    console.log(`  ${sym.padEnd(8)} ${(val * 100).toFixed(4)}%`);
  }

  // Fetch all reactions including new magnitude-based scores + pts
  const { data: rxData } = await sb
    .from("historical_reactions")
    .select("event_type_id, symbol, sample_size, avg_abs_pct_1m, avg_abs_pts_1m, avg_abs_pct_5m, avg_abs_pts_5m, max_abs_pct_15m, vol_score, open_vol_score, one_min_score, avg_intraday_range_pct")
    .gte("sample_size", 3);
  const reactions = (rxData ?? []) as Array<ReactionRow & {
    open_vol_score: number | null;
    one_min_score: number | null;
    avg_intraday_range_pct: number | null;
    avg_abs_pct_1m: number | null;
    avg_abs_pts_1m: number | null;
    avg_abs_pts_5m: number | null;
  }>;

  const { data: etData } = await sb.from("event_types").select("id, slug");
  const slugById = new Map(((etData ?? []) as EventTypeRow[]).map((e) => [e.id, e.slug]));

  // ---- baseline 90m range per symbol (rolling windows over 5000 bars) ----
  const baseline90mBySymbol = new Map<string, number>();
  for (const sym of symbols) {
    const { data: barsData } = await sb
      .from("price_bars_1m")
      .select("ts, high, low, close")
      .eq("symbol", sym.ticker)
      .order("ts", { ascending: true })
      .limit(5000);
    const bars = (barsData ?? []) as Array<{ ts: string; high: number; low: number; close: number }>;
    const out: number[] = [];
    const span = 90, step = 30;
    for (let i = 0; i + span < bars.length; i += step) {
      const slice = bars.slice(i, i + span);
      const dt = new Date(slice[slice.length - 1].ts).getTime() - new Date(slice[0].ts).getTime();
      if (dt > (span + 10) * 60_000) continue;
      let hi = -Infinity, lo = Infinity;
      for (const b of slice) { if (b.high > hi) hi = b.high; if (b.low < lo) lo = b.low; }
      const ref = slice[0].close;
      if (!ref || ref === 0) continue;
      out.push((hi - lo) / ref);
    }
    if (out.length === 0) { baseline90mBySymbol.set(sym.ticker, 0); continue; }
    const sorted = out.sort((a, b) => a - b);
    baseline90mBySymbol.set(sym.ticker, sorted[Math.floor(sorted.length / 2)]);
  }

  console.log(`\n=== ${reactions.length} (event_type, symbol) pairs with sample_size >= 3 ===\n`);
  console.log(
    `${"slug".padEnd(22)} ${"symbol".padEnd(8)} ${"n".padStart(3)}  ${"1m_pts".padStart(8)}  ${"5m_pts".padStart(8)}  ${"intra_pts".padStart(10)}  1m  vol  open`,
  );
  console.log("-".repeat(100));

  const rows = reactions
    .map((r) => {
      const slug = slugById.get(r.event_type_id) ?? "?";
      // Derive native units per 1.0 of pct ratio (price proxy)
      const unitsPerPct = r.avg_abs_pts_5m != null && r.avg_abs_pct_5m != null && r.avg_abs_pct_5m !== 0
        ? r.avg_abs_pts_5m / r.avg_abs_pct_5m
        : null;
      const intradayUnits = unitsPerPct != null && r.avg_intraday_range_pct != null
        ? unitsPerPct * r.avg_intraday_range_pct
        : null;
      return {
        slug, symbol: r.symbol, n: r.sample_size,
        pts1: r.avg_abs_pts_1m,
        pts5: r.avg_abs_pts_5m,
        intraPts: intradayUnits,
        oneMin: r.one_min_score,
        vol: r.vol_score,
        open: r.open_vol_score,
      };
    })
    .sort((a, b) => (b.pts5 ?? 0) - (a.pts5 ?? 0));

  for (const r of rows) {
    const pts1Str = r.pts1 != null ? r.pts1.toFixed(2) : "—";
    const pts5Str = r.pts5 != null ? r.pts5.toFixed(2) : "—";
    const intraPtsStr = r.intraPts != null ? r.intraPts.toFixed(2) : "—";
    console.log(
      `${r.slug.padEnd(22)} ${r.symbol.padEnd(8)} ${String(r.n).padStart(3)}  ${pts1Str.padStart(8)}  ${pts5Str.padStart(8)}  ${intraPtsStr.padStart(10)}  ${String(r.oneMin ?? "—").padStart(2)}  ${String(r.vol ?? "—").padStart(3)}  ${String(r.open ?? "—").padStart(4)}`,
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
