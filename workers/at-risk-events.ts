import { getServiceClient } from './lib/supabase.js';

const sb = getServiceClient();

async function main() {
  const now = Date.now();
  const cutoff28 = new Date(now - 28 * 24 * 3600_000).toISOString();
  const cutoff25 = new Date(now - 25 * 24 * 3600_000).toISOString();

  const { data: events, error } = await sb
    .from('events')
    .select('id, release_at, title, event_type_id')
    .not('event_type_id', 'is', null)
    .gte('release_at', cutoff28)
    .lt('release_at', new Date(now).toISOString())
    .order('release_at', { ascending: true });
  if (error) throw error;

  const { data: symbols } = await sb.from('symbols').select('ticker');
  const symCount = symbols?.length ?? 0;

  let atRisk: string[] = [];
  let withBars = 0;
  let withoutBars = 0;

  for (const ev of events ?? []) {
    const releaseAt = new Date(ev.release_at).getTime();
    const from = new Date(releaseAt - 120 * 60_000).toISOString();
    const to = new Date(releaseAt + 120 * 60_000).toISOString();
    const { count } = await sb
      .from('price_bars_1m')
      .select('ts', { count: 'exact', head: true })
      .gte('ts', from)
      .lte('ts', to);
    if ((count ?? 0) >= 60) withBars++;
    else {
      withoutBars++;
      if (ev.release_at < cutoff25) {
        atRisk.push(`${ev.release_at.slice(0,16)} — ${ev.title}`);
      }
    }
  }

  console.log(JSON.stringify({
    window: '28-day backfill range',
    events_total: events?.length ?? 0,
    events_with_bars: withBars,
    events_without_bars: withoutBars,
    AT_RISK_25_to_28_days_old: atRisk.length,
    at_risk_list: atRisk,
    symbols_tracked: symCount,
    yfinance_window_buffer_days: 2,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
