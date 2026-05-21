// Supabase Edge Function: on-demand enrichment of a single breaking_headlines row.
//
// POST /functions/v1/on-demand-enrich
// Headers:   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
// Body:      { "headline_id": "<uuid>" }
//
// Looks up the headline, calls Gemini with Google Search grounding (E.2),
// updates the row with summary/market_implication/affected_symbols/confidence.
//
// Use cases:
//   1. UI "re-verify" button
//   2. Retry a row that failed/skipped during poll-breaking (quota hit)
//
// Deployed via: supabase functions deploy on-demand-enrich
// Required secrets: GEMINI_KEY_RESEARCHER (set via `supabase secrets set`)

// @ts-expect-error — Deno-only import path; resolves at runtime in Supabase Edge runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0';
// @ts-expect-error — Deno-only import path.
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.0';

// @ts-expect-error — Deno global.
const Deno = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno!;

interface BreakingOutput {
  verified: boolean;
  summary_60w: string;
  market_implication: string;
  affected_symbols: string[];
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
}

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

function buildPrompt(h: {
  headline: string;
  source_name: string;
  published_at: string;
  source_url: string | null;
}): string {
  const lines = [
    '[v1] You are a verification analyst for US day-traders.',
    `Headline: "${h.headline}"`,
    `Reported by: ${h.source_name}`,
    `Published: ${h.published_at}`,
  ];
  if (h.source_url) lines.push(`Source URL: ${h.source_url}`);
  lines.push(
    '',
    'Use Google Search to verify against tier-1 sources only:',
    '  Reuters, Bloomberg, Financial Times, Wall Street Journal,',
    '  federalreserve.gov, ecb.europa.eu, bls.gov, treasury.gov.',
    '',
    'If you cannot confirm from those, set verified=false.',
    '',
    'Return JSON only, no markdown:',
    '  verified (boolean), summary_60w (≤60 words), market_implication (≤40 words),',
    '  affected_symbols (1-6 of SPY/QQQ/ES/NQ/CL/GC/EURUSD/GBPUSD/USDJPY/AUDUSD/^VIX),',
    '  sources (URLs), confidence ("high"|"medium"|"low").',
  );
  return lines.join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Deno?.serve?.(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = req.headers.get('Authorization') ?? '';
  const expected = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
  if (auth !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { headline_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }
  if (!body.headline_id) {
    return new Response('Missing headline_id', { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const geminiKey = Deno.env.get('GEMINI_KEY_RESEARCHER')!;
  if (!geminiKey) {
    return new Response('GEMINI_KEY_RESEARCHER not configured', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: row, error: fetchErr } = await supabase
    .from('breaking_headlines')
    .select('id, headline, source_name, source_url, published_at')
    .eq('id', body.headline_id)
    .single();

  if (fetchErr || !row) {
    return new Response(`Headline not found: ${fetchErr?.message ?? 'no row'}`, { status: 404 });
  }

  const prompt =
    buildPrompt({
      headline: row.headline,
      source_name: row.source_name,
      published_at: row.published_at,
      source_url: row.source_url,
    }) + '\n\nIMPORTANT: Respond with valid JSON only — no markdown, no code blocks, no extra text.';

  const genai = new GoogleGenerativeAI(geminiKey);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = genai.getGenerativeModel({
    model: GEMINI_MODEL,
    tools: [{ googleSearch: {} }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  let payload: BreakingOutput;
  try {
    const result = await model.generateContent(prompt);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = (result as any).response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    payload = JSON.parse(cleaned) as BreakingOutput;
  } catch (err) {
    return new Response(`Gemini call failed: ${(err as Error).message}`, { status: 502 });
  }

  const { error: upErr } = await supabase
    .from('breaking_headlines')
    .update({
      summary: payload.summary_60w,
      market_implication: payload.market_implication,
      affected_symbols: payload.affected_symbols,
      ai_confidence: payload.confidence,
      ai_verified: payload.verified,
      ai_enriched: true,
      ai_enriched_at: new Date().toISOString(),
    })
    .eq('id', body.headline_id);

  if (upErr) {
    return new Response(`Update failed: ${upErr.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, headline_id: body.headline_id, payload }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
