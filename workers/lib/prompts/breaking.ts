// E.2 — Breaking-news verifier + summarizer.
// Uses Gemini with Google Search grounding to confirm a headline against
// trusted sources (Reuters/Bloomberg/FT/WSJ/central banks). Rejects rumors.
//
// IMPORTANT: Gemini API does not allow responseSchema + Google Search together.
// We use prompt-driven JSON. The gemini.ts wrapper appends a strict-JSON nudge
// and parses the response.

export interface BreakingOutput {
  verified: boolean;
  summary_60w: string;
  market_implication: string;
  affected_symbols: string[];
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
}

const TEMPLATE_VERSION = 'v1';

// Returned to gemini.ts as `schema`, which triggers JSON parsing of the
// search-grounded text response.
export const BREAKING_SCHEMA = {
  type: 'OBJECT',
  properties: {
    verified:           { type: 'BOOLEAN' },
    summary_60w:        { type: 'STRING' },
    market_implication: { type: 'STRING' },
    affected_symbols:   { type: 'ARRAY', items: { type: 'STRING' } },
    sources:            { type: 'ARRAY', items: { type: 'STRING' } },
    confidence:         { type: 'STRING', enum: ['high', 'medium', 'low'] },
  },
  required: [
    'verified', 'summary_60w', 'market_implication',
    'affected_symbols', 'sources', 'confidence',
  ],
};

export function buildBreakingPrompt(headline: {
  text: string;
  source_name: string;
  published_at: string;
  source_url: string | null;
}): string {
  // The source IS already tier-1 when it comes from Fed, ECB, or WSJ.
  // In those cases the headline is self-verifying — we still want a summary.
  const sourceIsTier1 = headline.source_name === 'fed'
    || headline.source_name === 'ecb'
    || headline.source_name === 'wsj';

  const lines = [
    `[${TEMPLATE_VERSION}] You are a verification analyst for US day-traders.`,
    `Headline: "${headline.text}"`,
    `Reported by: ${headline.source_name}`,
    `Published: ${headline.published_at}`,
  ];
  if (headline.source_url) lines.push(`Source URL: ${headline.source_url}`);

  if (sourceIsTier1) {
    lines.push(
      '',
      `The reporting source (${headline.source_name}) is itself a tier-1 publisher.`,
      'You MAY treat this headline as confirmed without external corroboration.',
      'Use Google Search to gather additional context (market reaction, related coverage),',
      'but set verified=true based on the source alone. ALWAYS produce a summary —',
      'even for administrative or routine announcements (Fed minutes, FOMC statements, ECB releases).',
    );
  } else {
    lines.push(
      '',
      'Use Google Search to verify this headline against:',
      '  Reuters, Bloomberg, Financial Times, Wall Street Journal,',
      '  or official central-bank / government pages (federalreserve.gov, ecb.europa.eu, bls.gov, treasury.gov).',
      '',
      'If you cannot confirm the headline from at least one of those tier-1 sources,',
      'set verified=false. Rumors, social-media-only, blog-only, or speculative pieces => verified=false.',
      'Even when verified=false, still produce summary_60w and market_implication based on the headline text.',
    );
  }

  lines.push(
    '',
    'Return JSON only, no markdown, no code fences, exactly these fields:',
    '  verified            (boolean)',
    '  summary_60w         (string, ≤ 60 words, neutral factual)',
    '  market_implication  (string, ≤ 40 words, what a day trader should expect)',
    '  affected_symbols    (string[], 1–6 from: SPY, QQQ, ES, NQ, CL, GC, EURUSD, GBPUSD, USDJPY, AUDUSD, ^VIX)',
    '  sources             (string[], tier-1 publisher URLs you actually verified against)',
    '  confidence          ("high" | "medium" | "low")',
  );

  return lines.join('\n');
}
