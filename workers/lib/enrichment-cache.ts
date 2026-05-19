import type { SupabaseClient } from '@supabase/supabase-js';
import { promptHash } from './prompt-hash.js';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

export async function getCachedEnrichment(
  supabase: SupabaseClient,
  eventId: string | null,
  kind: string,
  promptText: string,
  eventTypeId: string | null = null,
): Promise<{ payload: unknown } | null> {
  const hash = promptHash(promptText);

  let query = supabase
    .from('ai_enrichments')
    .select('payload')
    .eq('kind', kind)
    .eq('prompt_hash', hash)
    .gt('expires_at', new Date().toISOString());

  if (eventId) {
    query = query.eq('event_id', eventId);
  } else if (eventTypeId) {
    query = query.eq('event_type_id', eventTypeId);
  } else {
    return null;
  }

  const { data } = await query.maybeSingle();
  return data ? { payload: data.payload } : null;
}

export async function upsertEnrichment(
  supabase: SupabaseClient,
  {
    eventId,
    eventTypeId,
    kind,
    promptText,
    payload,
    tokens_in,
    tokens_out,
    ttlDays,
  }: {
    eventId: string | null;
    eventTypeId: string | null;
    kind: string;
    promptText: string;
    payload: unknown;
    tokens_in: number;
    tokens_out: number;
    ttlDays: number;
  },
): Promise<void> {
  const hash = promptHash(promptText);
  const expires_at = new Date(Date.now() + ttlDays * 864e5).toISOString();

  const { error } = await supabase.from('ai_enrichments').upsert(
    {
      event_id: eventId,
      event_type_id: eventTypeId,
      kind,
      model: GEMINI_MODEL,
      prompt_hash: hash,
      payload,
      tokens_in,
      tokens_out,
      expires_at,
    },
    { onConflict: 'event_id,kind,prompt_hash' },
  );

  if (error) throw new Error(`upsertEnrichment failed: ${error.message}`);
}
