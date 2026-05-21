import { getServiceClient } from './lib/supabase.js';
import { callGemini, QuotaSoftLimitError, QuotaHardLimitError, EmptyResponseError } from './lib/gemini.js';
import { getCachedEnrichment, upsertEnrichment } from './lib/enrichment-cache.js';
import { buildExplainerPrompt, isSpeechEvent, EXPLAINER_SCHEMA } from './lib/prompts/explainer.js';

async function main() {
  const supabase = getServiceClient();

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // High + medium impact events in the next 48h, closest first
  const { data: events, error } = await supabase
    .from('events')
    .select(`
      id, title, release_at, impact, currency,
      event_occurrences( forecast, previous )
    `)
    .in('impact', ['high', 'medium'])
    .gte('release_at', now.toISOString())
    .lte('release_at', in48h.toISOString())
    .order('release_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch events:', error.message);
    process.exit(1);
  }

  if (!events?.length) {
    console.log('No upcoming high/medium events in next 48h — done.');
    return;
  }

  console.log(`Found ${events.length} events to check.`);
  let enriched = 0, cached = 0, failed = 0;

  for (const ev of events) {
    const occ = Array.isArray(ev.event_occurrences) ? ev.event_occurrences[0] : ev.event_occurrences;
    const forecast = (occ as { forecast: number | null } | null)?.forecast ?? null;
    const previous = (occ as { previous: number | null } | null)?.previous ?? null;

    const promptText = buildExplainerPrompt({
      title: ev.title,
      currency: ev.currency,
      release_at: ev.release_at,
      impact: ev.impact,
      slug: ev.title, // use title for speech detection when slug unavailable
      forecast,
      previous,
    });

    try {
      const hit = await getCachedEnrichment(supabase, ev.id, 'explainer', promptText);
      if (hit) {
        console.log(`  [cache] ${ev.title}`);
        cached++;
        continue;
      }

      console.log(`  [enrich] ${ev.title}`);
      const isSpeech = isSpeechEvent(ev.title);

      const { json, tokens_in, tokens_out } = await callGemini({
        role: 'writer',
        supabase,
        prompt: promptText,
        schema: EXPLAINER_SCHEMA,
        useSearch: isSpeech,
      });

      await upsertEnrichment(supabase, {
        eventId: ev.id,
        eventTypeId: null,
        kind: 'explainer',
        promptText,
        payload: json!,
        tokens_in,
        tokens_out,
        ttlDays: 14,
      });

      enriched++;
      console.log(`    tokens: ${tokens_in} in / ${tokens_out} out`);
    } catch (err) {
      if (err instanceof QuotaSoftLimitError || err instanceof QuotaHardLimitError) {
        console.warn(`Quota limit: ${(err as Error).message} — stopping gracefully.`);
        process.exit(0);
      }
      if (err instanceof EmptyResponseError) {
        // Gemini refused (safety/recitation/no sources). Skip — next hourly run won't retry the same prompt anyway.
        console.warn(`  [skipped] ${ev.title}: ${(err as Error).message}`);
        failed++;
        continue;
      }
      console.error(`  [error] ${ev.title}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`Done — enriched: ${enriched}, cached: ${cached}, failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
