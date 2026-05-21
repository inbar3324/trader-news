import Parser from 'rss-parser';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const parser = new Parser({
  timeout: 10_000,
  headers: {
    'User-Agent': CHROME_UA,
    Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
  },
});

export interface RssItem {
  guid: string;            // unique id from feed
  title: string;
  link: string;
  pubDate: string;         // ISO timestamp
}

export async function parseRssFeed(url: string): Promise<RssItem[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const feed = await parser.parseURL(url);
      return (feed.items ?? [])
        .map(it => {
          const guid = (it.guid ?? it.link ?? it.title ?? '').toString();
          const title = (it.title ?? '').trim();
          const link = (it.link ?? '').trim();
          const pubDate = it.isoDate ?? it.pubDate ?? new Date().toISOString();
          if (!guid || !title) return null;
          return { guid, title, link, pubDate } as RssItem;
        })
        .filter((x): x is RssItem => x !== null);
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise(r => setTimeout(r, 1500));
    }
  }
  throw new Error(`parseRssFeed(${url}) failed: ${(lastErr as Error)?.message ?? lastErr}`);
}
