import { getServiceClient } from './lib/supabase.js';
import { callGemini, QuotaSoftLimitError, QuotaHardLimitError, EmptyResponseError } from './lib/gemini.js';
import { fetchAllSources, type NewsItem } from './lib/news-sources.js';
import {
  buildClassifierPrompt,
  CLASSIFIER_SCHEMA,
  type ClassifierOutput,
} from './lib/prompts/headline-classifier.js';
import {
  buildBreakingPrompt,
  BREAKING_SCHEMA,
  type BreakingOutput,
} from './lib/prompts/breaking.js';

// Safety caps per run — keep ~15 RPM Gemini limit comfortable.
const MAX_CLASSIFIER_CALLS = 30;
const MAX_VERIFIER_CALLS = 10;
const VERIFIER_THRESHOLD = 5;   // impact_score >= this triggers E.2

async function classifyHeadline(supabase: ReturnType<typeof getServiceClient>, item: NewsItem) {
  const prompt = buildClassifierPrompt({
    text: item.headline,
    source_name: item.source_name,
    published_at: item.published_at,
  });
  const { json } = await callGemini({
    role: 'writer',
    supabase,
    prompt,
    schema: CLASSIFIER_SCHEMA,
    useSearch: false,
  });
  return json as ClassifierOutput;
}

async function verifyHeadline(supabase: ReturnType<typeof getServiceClient>, item: NewsItem) {
  const prompt = buildBreakingPrompt({
    text: item.headline,
    source_name: item.source_name,
    published_at: item.published_at,
    source_url: item.source_url,
  });
  const { json } = await callGemini({
    role: 'researcher',
    supabase,
    prompt,
    schema: BREAKING_SCHEMA,
    useSearch: true,
  });
  return json as BreakingOutput;
}

// Fallback: same model, NO search grounding. With search off, responseSchema enforces
// JSON output and Gemini is far less likely to refuse / hit recitation filters.
// Used when the search-grounded primary path returns EmptyResponseError.
async function summarizeWithoutSearch(supabase: ReturnType<typeof getServiceClient>, item: NewsItem) {
  const prompt = [
    `Headline: "${item.headline}"`,
    `Reported by: ${item.source_name}`,
    `Published: ${item.published_at}`,
    item.source_url ? `Source URL: ${item.source_url}` : '',
    '',
    'Summarize this headline for US day-traders. Base your answer on the headline text only — do not invent facts.',
    'Even if the headline is administrative (Fed minutes, central-bank releases, regulatory notices), still produce a summary.',
    'Set verified=false (we are summarizing without external verification).',
    'Pick affected_symbols from: SPY, QQQ, ES, NQ, CL, GC, EURUSD, GBPUSD, USDJPY, AUDUSD, ^VIX.',
  ].filter(Boolean).join('\n');
  const { json } = await callGemini({
    role: 'writer',
    supabase,
    prompt,
    schema: BREAKING_SCHEMA,
    useSearch: false,
  });
  return json as BreakingOutput;
}

async function main() {
  const supabase = getServiceClient();

  console.log('Fetching news from 4 sources (Fed/ECB/WSJ/Yahoo)...');
  const items = await fetchAllSources();
  console.log(`  fetched ${items.length} unique items`);

  if (items.length === 0) {
    console.log('No items — done.');
    return;
  }

  // Insert all items, ignoring already-seen rows (unique source_id).
  // Returning '*' lets us know which rows are actually new.
  const { data: inserted, error: insErr } = await supabase
    .from('breaking_headlines')
    .upsert(
      items.map(it => ({
        source_id: it.source_id,
        source_name: it.source_name,
        headline: it.headline,
        source_url: it.source_url,
        published_at: it.published_at,
      })),
      { onConflict: 'source_id', ignoreDuplicates: true },
    )
    .select('id, source_id, source_name, headline, source_url, published_at, impact_score');

  if (insErr) {
    console.error('Insert failed:', insErr.message);
    process.exit(1);
  }

  // Only rows we haven't classified yet (impact_score IS NULL).
  // upsert with ignoreDuplicates returns ONLY the actually-inserted rows.
  const newRows = (inserted ?? []).filter(r => r.impact_score === null);
  console.log(`  ${newRows.length} new headlines to classify`);

  let classified = 0;
  let verified = 0;
  let skipped = 0;
  const enrichQueue: { id: string; item: NewsItem }[] = [];

  // Stage 1: E.6 classifier on every new row (with cap).
  for (const row of newRows.slice(0, MAX_CLASSIFIER_CALLS)) {
    try {
      const item: NewsItem = {
        source_id: row.source_id,
        source_name: row.source_name as NewsItem['source_name'],
        headline: row.headline,
        source_url: row.source_url,
        published_at: row.published_at,
      };
      const cls = await classifyHeadline(supabase, item);

      const { error: upErr } = await supabase
        .from('breaking_headlines')
        .update({
          impact_score: cls.impact_score,
          category: cls.category,
          classifier_reason: cls.reason,
          classified_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (upErr) {
        console.error(`  [classify-update] ${row.headline.slice(0, 60)}: ${upErr.message}`);
        continue;
      }

      classified++;
      console.log(`  [classify] ${cls.impact_score}/10 ${cls.category} — ${row.headline.slice(0, 80)}`);

      if (cls.impact_score >= VERIFIER_THRESHOLD && enrichQueue.length < MAX_VERIFIER_CALLS) {
        enrichQueue.push({ id: row.id, item });
      } else if (cls.impact_score < VERIFIER_THRESHOLD) {
        skipped++;
      }
    } catch (err) {
      if (err instanceof QuotaSoftLimitError || err instanceof QuotaHardLimitError) {
        console.warn(`Quota limit hit during classify: ${(err as Error).message}`);
        break;
      }
      console.error(`  [classify-error] ${row.headline.slice(0, 60)}: ${(err as Error).message}`);
    }
  }

  // Pick up high-impact rows from prior runs that never got verified
  // (verifier failed, hit per-run cap, Gemini returned empty, etc).
  // Without this, classified-but-unenriched rows stay "AI verification pending…" forever.
  const remainingSlots = MAX_VERIFIER_CALLS - enrichQueue.length;
  if (remainingSlots > 0) {
    const queuedIds = new Set(enrichQueue.map(q => q.id));
    const { data: stuck, error: stuckErr } = await supabase
      .from('breaking_headlines')
      .select('id, source_id, source_name, headline, source_url, published_at, impact_score')
      .gte('impact_score', VERIFIER_THRESHOLD)
      .eq('ai_enriched', false)
      .order('impact_score', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(remainingSlots + queuedIds.size);
    if (stuckErr) {
      console.error(`  [stuck-fetch] ${stuckErr.message}`);
    } else if (stuck && stuck.length > 0) {
      let added = 0;
      for (const row of stuck) {
        if (queuedIds.has(row.id)) continue;
        if (enrichQueue.length >= MAX_VERIFIER_CALLS) break;
        enrichQueue.push({
          id: row.id,
          item: {
            source_id: row.source_id,
            source_name: row.source_name as NewsItem['source_name'],
            headline: row.headline,
            source_url: row.source_url,
            published_at: row.published_at,
          },
        });
        added++;
      }
      if (added > 0) console.log(`  picked up ${added} stuck high-impact rows from prior runs`);
    }
  }

  if (newRows.length === 0 && enrichQueue.length === 0) {
    console.log('No new headlines and no stuck rows — done.');
    return;
  }

  // Stage 2: E.2 verifier — high-impact only.
  console.log(`Stage 2: verifying ${enrichQueue.length} high-impact headlines`);
  for (const { id, item } of enrichQueue) {
    try {
      const out = await verifyHeadline(supabase, item);

      const { error: upErr } = await supabase
        .from('breaking_headlines')
        .update({
          summary: out.summary_60w,
          market_implication: out.market_implication,
          affected_symbols: out.affected_symbols,
          ai_confidence: out.confidence,
          ai_verified: out.verified,
          ai_enriched: true,
          ai_enriched_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (upErr) {
        console.error(`  [verify-update] ${item.headline.slice(0, 60)}: ${upErr.message}`);
        continue;
      }

      verified++;
      console.log(`  [verify] ${out.verified ? '✓' : '✗'} ${out.confidence} — ${item.headline.slice(0, 80)}`);
    } catch (err) {
      if (err instanceof QuotaSoftLimitError || err instanceof QuotaHardLimitError) {
        console.warn(`Quota limit hit during verify: ${(err as Error).message}`);
        break;
      }
      if (err instanceof EmptyResponseError) {
        // Search-grounded path refused / hit recitation. Try the no-search fallback —
        // schema-enforced JSON is far more reliable when Google Search is off.
        try {
          const out = await summarizeWithoutSearch(supabase, item);
          const { error: upErr } = await supabase
            .from('breaking_headlines')
            .update({
              summary: out.summary_60w,
              market_implication: out.market_implication,
              affected_symbols: out.affected_symbols,
              ai_confidence: out.confidence,
              ai_verified: false,                // fallback never claims external verification
              ai_enriched: true,
              ai_enriched_at: new Date().toISOString(),
            })
            .eq('id', id);
          if (upErr) {
            console.error(`  [fallback-update] ${item.headline.slice(0, 60)}: ${upErr.message}`);
            continue;
          }
          verified++;
          console.log(`  [verify-fallback] ✓ no-search summary — ${item.headline.slice(0, 80)}`);
          continue;
        } catch (fallbackErr) {
          // Only permanently-mark the row if the fallback also got a definitive refusal
          // (EmptyResponseError = Gemini said no). For transient errors (503, timeout,
          // network), leave the row unmarked so a future run retries automatically.
          if (fallbackErr instanceof EmptyResponseError) {
            await supabase
              .from('breaking_headlines')
              .update({
                ai_enriched: true,
                ai_enriched_at: new Date().toISOString(),
                ai_verified: false,
                ai_confidence: 'low',
                summary: null,
                market_implication: null,
              })
              .eq('id', id);
            console.warn(
              `  [verify-double-skip] ${item.headline.slice(0, 60)}: ` +
              `primary=${(err as Error).message}; fallback=${(fallbackErr as Error).message}`,
            );
          } else {
            console.warn(
              `  [verify-transient] ${item.headline.slice(0, 60)} — will retry next run: ` +
              `${(fallbackErr as Error).message}`,
            );
          }
          continue;
        }
      }
      console.error(`  [verify-error] ${item.headline.slice(0, 60)}: ${(err as Error).message}`);
    }
  }

  console.log(`Done — classified: ${classified}, verified: ${verified}, low-impact skipped: ${skipped}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
