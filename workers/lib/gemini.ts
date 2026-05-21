import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SupabaseClient } from '@supabase/supabase-js';

export class QuotaSoftLimitError extends Error {
  constructor(msg: string) { super(msg); this.name = 'QuotaSoftLimitError'; }
}
export class QuotaHardLimitError extends Error {
  constructor(msg: string) { super(msg); this.name = 'QuotaHardLimitError'; }
}
export class EmptyResponseError extends Error {
  constructor(msg: string) { super(msg); this.name = 'EmptyResponseError'; }
}

// Legacy roles still recognized by callers — used only as a usage-stats tag now,
// no longer selects which API key gets used (the pool decides).
export type GeminiRole = 'writer' | 'researcher';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const RATE_LIMIT_MS = 4500;
const SOFT_LIMIT = 950;     // mark soft at 95% of 1000 RPD
let lastCallTs = 0;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function todayUTC(): string { return new Date().toISOString().slice(0, 10); }

/** Discovers all GEMINI_KEY_* env vars, in stable order, dropping empty values. */
function discoverKeyPool(): { slot: string; apiKey: string }[] {
  const out: { slot: string; apiKey: string }[] = [];
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith('GEMINI_KEY_')) continue;
    if (!value || value.trim() === '') continue;
    const slot = name.slice('GEMINI_KEY_'.length).toLowerCase();
    out.push({ slot, apiKey: value.trim() });
  }
  // Stable order: legacy names first (writer, researcher), then numeric slots ascending.
  return out.sort((a, b) => {
    const aNum = /^\d+$/.test(a.slot);
    const bNum = /^\d+$/.test(b.slot);
    if (a.slot === 'writer')     return -1;
    if (b.slot === 'writer')     return  1;
    if (a.slot === 'researcher') return -1;
    if (b.slot === 'researcher') return  1;
    if (aNum && bNum) return parseInt(a.slot, 10) - parseInt(b.slot, 10);
    return a.slot.localeCompare(b.slot);
  });
}

/** Fetches exhausted_at for each slot once at the start of a request. */
async function getExhaustedSlots(
  supabase: SupabaseClient,
  date: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('gemini_usage')
    .select('role, exhausted_at, calls_count')
    .eq('date', date);
  const out = new Set<string>();
  for (const r of data ?? []) {
    if (r.exhausted_at) out.add(r.role);
    else if ((r.calls_count ?? 0) >= SOFT_LIMIT) out.add(r.role);
  }
  return out;
}

async function markSlotExhausted(supabase: SupabaseClient, date: string, slot: string) {
  await supabase
    .from('gemini_usage')
    .upsert(
      { date, role: slot, exhausted_at: new Date().toISOString() },
      { onConflict: 'date,role' },
    );
}

async function attemptCall({
  slot,
  apiKey,
  prompt,
  schema,
  useSearch,
  timeoutMs,
}: {
  slot: string;
  apiKey: string;
  prompt: string;
  schema?: object;
  useSearch: boolean;
  timeoutMs: number;
}): Promise<{ text: string; json?: unknown; tokens_in: number; tokens_out: number }> {
  // Per-process rate-limit: ≤15 RPM means ≥4.5s between any two calls.
  const waitMs = RATE_LIMIT_MS - (Date.now() - lastCallTs);
  if (waitMs > 0) await sleep(waitMs);
  lastCallTs = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelParams: any = { model: GEMINI_MODEL };
  if (schema && !useSearch) {
    modelParams.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema,
    };
  }
  if (useSearch) {
    modelParams.tools = [{ googleSearch: {} }];
  }

  // When schema is needed AND search is active, both can't be set in generationConfig.
  // Ask the model to return JSON via the prompt text instead.
  let effectivePrompt = prompt;
  if (schema && useSearch) {
    effectivePrompt = prompt + '\n\nIMPORTANT: Respond with valid JSON only — no markdown, no code blocks, no extra text.';
  }

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel(modelParams);

  const result = await Promise.race([
    model.generateContent(effectivePrompt),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini timeout after ${timeoutMs}ms (slot=${slot})`)), timeoutMs)
    ),
  ]);

  const candidate = result.response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const text = candidate?.content?.parts?.[0]?.text ?? '';
  const tokens_in  = result.response.usageMetadata?.promptTokenCount ?? 0;
  const tokens_out = result.response.usageMetadata?.candidatesTokenCount ?? 0;

  // If Gemini stopped for safety/recitation/other reasons OR returned empty text under search grounding,
  // the response is unusable. Surface a specific error so callers can mark the row as verify-skipped.
  if (!text || (finishReason && finishReason !== 'STOP')) {
    throw new EmptyResponseError(
      `Gemini returned no usable text (slot=${slot}, finishReason=${finishReason ?? 'unknown'}, search=${useSearch})`,
    );
  }

  let json: unknown;
  if (schema) {
    const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    try {
      json = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new EmptyResponseError(
        `Gemini returned non-JSON text (slot=${slot}, len=${text.length}): ${(parseErr as Error).message}`,
      );
    }
  }

  return { text, json, tokens_in, tokens_out };
}

export async function callGemini({
  role,
  supabase,
  prompt,
  schema,
  useSearch = false,
  timeoutMs = 30_000,
}: {
  role: GeminiRole;
  supabase: SupabaseClient;
  prompt: string;
  schema?: object;
  useSearch?: boolean;
  timeoutMs?: number;
}): Promise<{ text: string; json?: unknown; tokens_in: number; tokens_out: number }> {
  const today = todayUTC();
  const pool = discoverKeyPool();
  if (pool.length === 0) {
    throw new Error('No Gemini API keys found in env (expected at least one GEMINI_KEY_*).');
  }

  const exhausted = await getExhaustedSlots(supabase, today);

  // Build candidate list: available slots first, in pool order.
  const candidates = pool.filter(k => !exhausted.has(k.slot));
  if (candidates.length === 0) {
    throw new QuotaHardLimitError(`All ${pool.length} Gemini key(s) exhausted for ${today} — resumes tomorrow`);
  }

  let lastQuotaError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const result = await attemptCall({
        slot: candidate.slot,
        apiKey: candidate.apiKey,
        prompt,
        schema,
        useSearch,
        timeoutMs,
      });

      // Success: increment usage for this slot (track separately, but tag with role for analytics).
      // Note: the `role` parameter is now an *intent* tag (writer-like vs researcher-like work),
      // recorded into the same row as the slot so analytics can still split the workload.
      await supabase.rpc('increment_gemini_usage', {
        p_date: today,
        p_role: candidate.slot,
        p_tokens_in: result.tokens_in,
        p_tokens_out: result.tokens_out,
      });

      if (process.env.GEMINI_DEBUG === '1') {
        console.log(`  [gemini] slot=${candidate.slot} role=${role} in=${result.tokens_in} out=${result.tokens_out}`);
      }
      return result;
    } catch (err: unknown) {
      const msg = String((err as Error)?.message ?? '');
      const lower = msg.toLowerCase();
      const isDailyQuota =
        lower.includes('resource_exhausted') ||
        lower.includes('resource exhausted') ||
        lower.includes('exceeded your current quota') ||
        lower.includes('quota exceeded') ||
        (lower.includes('quota') && lower.includes('day'));
      const isRateLimit429 = msg.includes('429') && !isDailyQuota;

      if (isDailyQuota) {
        // This key is done for the day. Mark + try next candidate.
        console.warn(`  [gemini] slot=${candidate.slot} hit DAILY quota — failover to next key`);
        await markSlotExhausted(supabase, today, candidate.slot);
        lastQuotaError = err as Error;
        continue;
      }
      if (isRateLimit429) {
        // Per-minute limit on THIS key — back off the whole call. Next caller retries.
        throw new QuotaSoftLimitError(`Gemini slot=${candidate.slot} per-minute rate limit — back off and retry next run`);
      }
      // Other error: propagate (network, schema parse, etc.)
      throw err;
    }
  }

  throw new QuotaHardLimitError(
    `All ${candidates.length} available Gemini key(s) reached daily quota during this call. ` +
    `Last error: ${lastQuotaError?.message ?? 'unknown'}`,
  );
}
