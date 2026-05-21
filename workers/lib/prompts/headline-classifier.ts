// E.6 — Cheap headline classifier.
// Runs on EVERY new breaking-news headline before deciding whether to spend
// an expensive E.2 verifier call. ~200 input + 100 output tokens per call.

export interface ClassifierOutput {
  impact_score: number;                                  // 1..10
  category: 'fed' | 'macro' | 'geo' | 'corp' | 'noise';
  reason: string;                                        // ≤ 20 words
}

const TEMPLATE_VERSION = 'v1';

export const CLASSIFIER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    impact_score: { type: 'INTEGER' },
    category:     { type: 'STRING', enum: ['fed', 'macro', 'geo', 'corp', 'noise'] },
    reason:       { type: 'STRING' },
  },
  required: ['impact_score', 'category', 'reason'],
};

export function buildClassifierPrompt(headline: {
  text: string;
  source_name: string;
  published_at: string;
}): string {
  return [
    `[${TEMPLATE_VERSION}] You triage financial news headlines for US day traders (futures, SPY/QQQ, FX majors).`,
    `Source: ${headline.source_name}`,
    `Published: ${headline.published_at}`,
    `Headline: "${headline.text}"`,
    '',
    'Rate market impact on a 1–10 scale:',
    '  10 = market halt / crash trigger (war, Fed emergency cut, central-bank surprise)',
    '   8 = major macro print or rate decision (CPI, NFP, FOMC, ECB)',
    '   6 = significant Fed speech, tariff escalation, large geopolitical event',
    '   4 = secondary data (jobless claims, PMI), mid-tier earnings of mega-caps',
    '   2 = sector news, small-cap moves',
    '   1 = noise, opinion pieces, recaps, "5 stocks to watch" listicles',
    '',
    'Category (pick one):',
    '  fed   — Federal Reserve, FOMC, Powell, Fed governors',
    '  macro — CPI/NFP/PCE/GDP/PMI/retail sales/central-bank actions',
    '  geo   — geopolitical (war, tariffs, sanctions, oil supply, elections)',
    '  corp  — single-company news (earnings, M&A, CEO changes)',
    '  noise — recaps, listicles, opinion, low-quality content',
    '',
    'Respond with JSON only matching the schema. Keep `reason` ≤ 20 words.',
  ].join('\n');
}
