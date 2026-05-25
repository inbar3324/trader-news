import { getServiceClient } from './lib/supabase.js';

const sb = getServiceClient();

async function main() {
  const { data, error } = await sb
    .from('historical_reactions')
    .select('sample_size, last_computed_at')
    .order('last_computed_at', { ascending: false });
  if (error) throw error;

  const total = data.length;
  const ready = data.filter((r) => r.sample_size >= 3).length;
  const n2 = data.filter((r) => r.sample_size === 2).length;
  const n1 = data.filter((r) => r.sample_size === 1).length;
  const latest = data[0]?.last_computed_at ?? 'n/a';

  const { data: bars } = await sb
    .from('price_bars_1m')
    .select('ts', { count: 'exact', head: false })
    .order('ts', { ascending: false })
    .limit(1);
  const latestBar = bars?.[0]?.ts ?? 'n/a';

  const { count: barsCount } = await sb
    .from('price_bars_1m')
    .select('*', { count: 'exact', head: true });

  console.log(JSON.stringify({
    historical_reactions: { total, ready_n_ge_3: ready, n2, n1, latest_recompute: latest },
    price_bars_1m: { total_rows: barsCount, latest_ts: latestBar },
    snapshot_at: new Date().toISOString(),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
