export interface ExplainerOutput {
  what: string;
  why_it_matters: string;
  agenda_or_topics: string;
  consensus_expectation: string;
  bullish_scenario: string;
  bearish_scenario: string;
  impacted_symbols: string[];
  watch_for: string;
}

const TEMPLATE_VERSION = 'v1';

const SPEECH_WORDS = [
  'speech', 'speaks', 'remarks', 'press conference', 'presser',
  'testimony', 'statement', 'powell', 'lagarde', 'bailey', 'ueda',
  'trump', 'fed chair', 'governor', 'minutes',
];

export function isSpeechEvent(slugOrTitle: string): boolean {
  const lower = slugOrTitle.toLowerCase();
  return SPEECH_WORDS.some(w => lower.includes(w));
}

export const EXPLAINER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    what:                  { type: 'STRING' },
    why_it_matters:        { type: 'STRING' },
    agenda_or_topics:      { type: 'STRING' },
    consensus_expectation: { type: 'STRING' },
    bullish_scenario:      { type: 'STRING' },
    bearish_scenario:      { type: 'STRING' },
    impacted_symbols:      { type: 'ARRAY', items: { type: 'STRING' } },
    watch_for:             { type: 'STRING' },
  },
  required: [
    'what', 'why_it_matters', 'agenda_or_topics', 'consensus_expectation',
    'bullish_scenario', 'bearish_scenario', 'impacted_symbols', 'watch_for',
  ],
};

export function buildExplainerPrompt(event: {
  title: string;
  currency: string;
  release_at: string;
  impact: string;
  slug: string;
  forecast?: number | null;
  previous?: number | null;
}): string {
  const isSpeech = isSpeechEvent(event.slug);
  const lines = [
    `[${TEMPLATE_VERSION}] You are an expert macro analyst for active US day traders.`,
    `Event: "${event.title}"`,
    `Economy/currency: ${event.currency}`,
    `Scheduled: ${event.release_at}`,
    `Impact: ${event.impact}`,
  ];
  if (event.forecast != null) lines.push(`Consensus forecast: ${event.forecast}`);
  if (event.previous != null) lines.push(`Previous reading: ${event.previous}`);

  lines.push(
    '',
    'Respond ONLY with JSON matching the schema. Each text field ≤90 words. Be precise and trader-focused.',
    '',
    'Field instructions:',
    '- what: Plain-English explanation of what this event measures or what is happening.',
    '- why_it_matters: Why this data moves markets for US day traders. Name the assets that react most (SPY, ES, EURUSD, etc).',
    isSpeech
      ? '- agenda_or_topics: Use Google Search grounding to find specific topics this speech/presser is expected to cover and key questions the market is watching.'
      : '- agenda_or_topics: Summarize what components the print includes (e.g. core vs headline, sectors). If not a release with sub-components, write "N/A".',
    '- consensus_expectation: Current market consensus as a specific number or range (e.g. "Street: 3.1% YoY, range 2.9–3.3%").' + (isSpeech ? ' For a speech: what tone/message is the market pricing in.' : ' Use the provided forecast if available.'),
    '- bullish_scenario: Specific outcome that drives a bullish reaction — state the threshold and expected asset move.',
    '- bearish_scenario: Specific outcome that drives a bearish reaction — state the threshold and expected asset move.',
    '- impacted_symbols: 2–6 tickers from: SPY, QQQ, ES, NQ, CL, GC, EURUSD, GBPUSD, USDJPY, AUDUSD. Use standard format (no =X suffix).',
    '- watch_for: One or two specific surprise triggers that would dramatically amplify the market reaction.',
  );

  return lines.join('\n');
}
