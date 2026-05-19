export interface VolScoreRationaleOutput {
  rationale: string;
}

const TEMPLATE_VERSION = 'v1';

export const VOL_SCORE_RATIONALE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    rationale: { type: 'STRING' },
  },
  required: ['rationale'],
};

export interface VolScoreRationaleInput {
  display_name: string;
  slug: string;
  category: string;
  description: string | null;
  vol_score: number;
  reference_symbol: string;
  sample_size: number;
  avg_abs_pct_5m: number | null;
  max_abs_pct_15m: number | null;
  median_abs_pct_15m: number | null;
  directional_bias_up_pct: number | null;
  reversal_rate_15m: number | null;
  vol_score_percentile_label: string;
}

export function volScorePercentileLabel(score: number): string {
  if (score >= 9) return 'top decile';
  if (score >= 7) return 'top quartile';
  if (score >= 4) return 'middle of the distribution';
  return 'bottom quartile';
}

function fmtPct(n: number | null): string {
  if (n == null) return 'n/a';
  return `${(Math.round(n * 100) / 100).toFixed(2)}%`;
}

function fmtRatio(n: number | null): string {
  if (n == null) return 'n/a';
  return `${(Math.round(n * 100) / 100).toFixed(2)}`;
}

export function buildVolScoreRationalePrompt(input: VolScoreRationaleInput): string {
  const lines = [
    `[${TEMPLATE_VERSION}] You are an expert macro analyst for active US day traders.`,
    `Event type: "${input.display_name}" (${input.slug}, category: ${input.category})`,
  ];
  if (input.description) lines.push(`What it is: ${input.description}`);

  lines.push(
    '',
    `Volatility score: ${input.vol_score}/10 (${input.vol_score_percentile_label} across all tracked event types).`,
    `Reference instrument: ${input.reference_symbol} (sample size: ${input.sample_size} past occurrences).`,
    `Average absolute 5-minute reaction: ${fmtPct(input.avg_abs_pct_5m)}.`,
    `Max absolute 15-minute reaction: ${fmtPct(input.max_abs_pct_15m)} (median: ${fmtPct(input.median_abs_pct_15m)}).`,
    `Directional bias (% past prints where 15m close was above release): ${fmtRatio(input.directional_bias_up_pct)}.`,
    `15-minute reversal rate (% prints where 15m direction flipped 5m direction): ${fmtRatio(input.reversal_rate_15m)}.`,
    '',
    'Respond ONLY with JSON matching the schema.',
    '',
    'Field instructions:',
    '- rationale: 1–2 sentences (≤55 words total) explaining WHY this event type earns this vol score. Cite the specific stat(s) that drive it (typical 5m thrust, 15m max range, directional bias, or reversal rate). Be concrete and trader-focused. No emojis. No hedging language ("might", "could potentially"). No restating the score number.',
  );

  return lines.join('\n');
}
