import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SupabaseClient } from '@supabase/supabase-js';

export class QuotaSoftLimitError extends Error {
  constructor(msg: string) { super(msg); this.name = 'QuotaSoftLimitError'; }
}
export class QuotaHardLimitError extends Error {
  constructor(msg: string) { super(msg); this.name = 'QuotaHardLimitError'; }
}

type GeminiRole = 'writer' | 'researcher';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const RATE_LIMIT_MS = 4500;
let lastCallTs = 0;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function todayUTC(): string { return new Date().toISOString().slice(0, 10); }

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

  // 1. Check soft quota (reads DB row for today + role)
  const { data: usage } = await supabase
    .from('gemini_usage')
    .select('calls_count, exhausted_at')
    .eq('date', today)
    .eq('role', role)
    .maybeSingle();

  if (usage?.exhausted_at) {
    throw new QuotaHardLimitError(`Gemini ${role} hard-limited on ${today} — resumes tomorrow`);
  }
  if ((usage?.calls_count ?? 0) >= 950) {
    throw new QuotaSoftLimitError(`Gemini ${role} soft limit (950/1000) reached for ${today}`);
  }

  // 2. Rate limit: ≤15 RPM → at least 4.5s between calls in this process
  const waitMs = RATE_LIMIT_MS - (Date.now() - lastCallTs);
  if (waitMs > 0) await sleep(waitMs);
  lastCallTs = Date.now();

  // 3. Build model config
  const apiKey = role === 'writer'
    ? process.env.GEMINI_KEY_WRITER!
    : process.env.GEMINI_KEY_RESEARCHER!;

  if (!apiKey) throw new Error(`Missing env var for Gemini ${role} key`);

  const genai = new GoogleGenerativeAI(apiKey);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelParams: any = { model: GEMINI_MODEL };

  // Gemini API limitation: cannot use responseSchema + Google Search simultaneously.
  // For search calls, request JSON via the prompt text instead and parse manually.
  if (schema && !useSearch) {
    modelParams.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema,
    };
  }
  if (useSearch) {
    modelParams.tools = [{ googleSearch: {} }];
  }

  // When schema is needed but search is also active, instruct via prompt
  if (schema && useSearch) {
    prompt = prompt + '\n\nIMPORTANT: Respond with valid JSON only — no markdown, no code blocks, no extra text.';
  }

  const model = genai.getGenerativeModel(modelParams);

  // 4. Call with timeout via Promise.race
  let result: Awaited<ReturnType<typeof model.generateContent>>;
  try {
    result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? '');
    if (msg.includes('429') || msg.includes('quota') || msg.toLowerCase().includes('resource exhausted')) {
      await supabase
        .from('gemini_usage')
        .upsert({ date: today, role, exhausted_at: new Date().toISOString() }, { onConflict: 'date,role' });
      throw new QuotaHardLimitError(`Gemini ${role} hard quota (429) on ${today}`);
    }
    throw err;
  }

  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const tokens_in  = result.response.usageMetadata?.promptTokenCount ?? 0;
  const tokens_out = result.response.usageMetadata?.candidatesTokenCount ?? 0;

  // 5. Atomic counter increment via RPC (avoids read-modify-write race)
  await supabase.rpc('increment_gemini_usage', {
    p_date: today,
    p_role: role,
    p_tokens_in: tokens_in,
    p_tokens_out: tokens_out,
  });

  let json: unknown;
  if (schema) {
    // Strip markdown code fences Gemini sometimes adds when schema is prompted via text
    const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    json = JSON.parse(cleaned);
  }

  return { text, json, tokens_in, tokens_out };
}
