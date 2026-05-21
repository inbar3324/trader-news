import { createHash } from 'crypto';
import { parseRssFeed } from './rss.js';

// Note about sources (validated 2026-05):
//   Fed press_all  → too noisy (bureaucratic approvals dominate). Use press_monetary + speeches.
//   BLS feed       → 403 (IP-blocked on common cloud egress). Drop. CPI/NFP arrive via Fed + WSJ anyway.
//   Reuters Agency → endpoint discontinued / 404. Replace with WSJ Markets + Economy feeds.
//   Yahoo search() → 429 rate-limited. Use per-ticker RSS endpoint instead.

export type SourceName = 'fed' | 'ecb' | 'wsj' | 'yahoo';

export interface NewsItem {
  source_id: string;
  source_name: SourceName;
  headline: string;
  source_url: string | null;
  published_at: string;
}

const RSS_SOURCES: { name: SourceName; url: string }[] = [
  // Fed — monetary-policy actions and FOMC statements
  { name: 'fed', url: 'https://www.federalreserve.gov/feeds/press_monetary.xml' },
  // Fed — speeches by Chair Powell and other Fed officials
  { name: 'fed', url: 'https://www.federalreserve.gov/feeds/speeches.xml' },
  // ECB — press releases (rate decisions, Lagarde remarks)
  { name: 'ecb', url: 'https://www.ecb.europa.eu/rss/press.html' },
  // WSJ — markets + economy beat (replaces Reuters/BLS as tier-1 wire)
  { name: 'wsj', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
  { name: 'wsj', url: 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml' },
];

const YAHOO_TICKERS = ['SPY', 'QQQ', 'EURUSD=X', 'GBPUSD=X', 'USDJPY=X', '^VIX'];

function shortHash(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 16);
}

async function fetchRssSource(name: SourceName, url: string): Promise<NewsItem[]> {
  try {
    const items = await parseRssFeed(url);
    return items.map(it => ({
      source_id: `${name}:${shortHash(it.guid)}`,
      source_name: name,
      headline: it.title,
      source_url: it.link || null,
      published_at: it.pubDate,
    }));
  } catch (err) {
    console.warn(`  [rss:${name}] failed: ${(err as Error).message}`);
    return [];
  }
}

async function fetchYahooPerTicker(): Promise<NewsItem[]> {
  const out: NewsItem[] = [];
  await Promise.all(YAHOO_TICKERS.map(async ticker => {
    const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`;
    try {
      const items = await parseRssFeed(url);
      for (const it of items) {
        out.push({
          source_id: `yahoo:${shortHash(it.guid)}`,
          source_name: 'yahoo',
          headline: it.title,
          source_url: it.link || null,
          published_at: it.pubDate,
        });
      }
    } catch (err) {
      console.warn(`  [yahoo:${ticker}] failed: ${(err as Error).message}`);
    }
  }));
  return out;
}

export async function fetchAllSources(): Promise<NewsItem[]> {
  const [rssAll, yahooAll] = await Promise.all([
    Promise.all(RSS_SOURCES.map(s => fetchRssSource(s.name, s.url))).then(arr => arr.flat()),
    fetchYahooPerTicker(),
  ]);

  const all = [...rssAll, ...yahooAll];

  // In-batch dedupe by source_id; DB unique constraint handles across polls.
  const seen = new Set<string>();
  return all.filter(item => {
    if (seen.has(item.source_id)) return false;
    seen.add(item.source_id);
    return true;
  });
}
