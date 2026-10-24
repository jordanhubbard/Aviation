import type { NormalizedEvent } from './types.js';
import type { SourceAttribution } from '../types.js';

// Fetch each publisher once per ingest run. Store links and headlines only; article
// text remains with its publisher. A failed feed must not delay official ingestion.
export const MEDIA_FEEDS = [
  { name: 'AVweb', url: 'https://avweb.com/feed/' },
  { name: 'FLYING', url: 'https://www.flyingmag.com/feed/' },
  { name: 'AeroTime', url: 'https://www.aerotime.aero/feed' },
  { name: 'AOPA', url: 'https://www.aopa.org/rss' },
  { name: 'Plane & Pilot', url: 'https://planeandpilotmag.com/feed/' },
] as const;

const SEARCH_PUBLISHERS = [
  { name: 'AVweb', host: 'avweb.com' },
  { name: 'FLYING', host: 'www.flyingmag.com' },
  { name: 'AeroTime', host: 'www.aerotime.aero' },
  { name: 'Plane & Pilot', host: 'planeandpilotmag.com' },
] as const;

export interface MediaArticle {
  publisher: string;
  title: string;
  url: string;
  publishedAt: string;
  excerpt: string;
}

function searchableRegistration(value: string): boolean {
  return /^[A-Z0-9-]{4,10}$/.test(value) && /[0-9-]/.test(value)
    && !['UNKNOWN', 'NONE', 'NULL', 'N/A', 'UNKN'].includes(value);
}

const ACCIDENT_CONTEXT = /\b(?:accident|crash(?:ed|es)?|incident|emergency|fatal(?:ity|ities)?|collision|wreck(?:age)?|forced landing|hard landing|investigat(?:e|ion|ing)|overrun|runway excursion|downed|went down|missing aircraft)\b/i;

function decode(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, number: string) => String.fromCodePoint(Number(number)))
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, entity =>
      ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[entity] ?? entity)
    .replace(/\s+/g, ' ').trim();
}

function tag(item: string, name: string): string {
  return item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '';
}

export function parseMediaFeed(xml: string, publisher: string): MediaArticle[] {
  const articles: MediaArticle[] = [];
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const item = match[1];
    const title = decode(tag(item, 'title'));
    const url = decode(tag(item, 'link'));
    const published = Date.parse(decode(tag(item, 'pubDate')));
    if (!title || !Number.isFinite(published)) continue;
    try {
      if (new URL(url).protocol !== 'https:') continue;
    } catch { continue; }
    articles.push({ publisher, title, url, publishedAt: new Date(published).toISOString(),
      excerpt: decode(tag(item, 'description')).slice(0, 1000) });
    if (articles.length >= 100) break;
  }
  return articles;
}

export async function fetchMediaArticles(): Promise<MediaArticle[]> {
  const results = await Promise.allSettled(MEDIA_FEEDS.map(async feed => {
    const response = await fetch(feed.url, { signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'AviationAccidentTracker/1.0 (+https://github.com/jordanhubbard/Aviation)' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = await response.text();
    if (content.length > 1_000_000) throw new Error('Feed too large');
    return parseMediaFeed(content, feed.name);
  }));
  return results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    console.warn(`[media] ${MEDIA_FEEDS[index].name} unavailable: ${String(result.reason)}`);
    return [];
  });
}

export async function searchPublisherArticles(registration: string): Promise<MediaArticle[]> {
  if (!searchableRegistration(registration)) return [];
  const results = await Promise.allSettled(SEARCH_PUBLISHERS.map(async publisher => {
    const url = new URL(`https://${publisher.host}/wp-json/wp/v2/posts`);
    url.searchParams.set('search', registration);
    url.searchParams.set('per_page', '5');
    url.searchParams.set('_fields', 'date,link,title,content');
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'AviationAccidentTracker/1.0 (+https://github.com/jordanhubbard/Aviation)' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error('Search response too large');
    const posts = JSON.parse(body) as { date?: string; link?: string; title?: { rendered?: string }; content?: { rendered?: string } }[];
    if (!Array.isArray(posts)) return [];
    const escaped = registration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^A-Z0-9])${escaped}(?=$|[^A-Z0-9])`, 'i');
    return posts.flatMap(post => {
      const content = decode(post.content?.rendered ?? '');
      const title = decode(post.title?.rendered ?? '');
      if (!pattern.test(`${title} ${content}`) || !post.date || !post.link) return [];
      let link: URL;
      try { link = new URL(post.link); } catch { return []; }
      const domain = publisher.host.replace(/^www\./, '');
      if (link.protocol !== 'https:' || (link.hostname !== domain && !link.hostname.endsWith(`.${domain}`))) return [];
      const published = Date.parse(post.date);
      if (!Number.isFinite(published)) return [];
      const match = pattern.exec(content);
      const excerpt = match ? content.slice(Math.max(0, match.index - 350), match.index + 500) : '';
      return [{ publisher: publisher.name, title, url: link.toString(),
        publishedAt: new Date(published).toISOString(), excerpt }];
    });
  }));
  return results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    console.warn(`[media] ${SEARCH_PUBLISHERS[index].name} search unavailable: ${String(result.reason)}`);
    return [];
  });
}

export function mediaCitations(event: Pick<NormalizedEvent, 'registration' | 'dateZ' | 'sources'>, articles: MediaArticle[]): SourceAttribution[] {
  const registration = event.registration.toUpperCase().trim();
  if (!searchableRegistration(registration)) return [];
  const escaped = registration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const registrationPattern = new RegExp(`(^|[^A-Z0-9])${escaped}(?=$|[^A-Z0-9])`, 'i');
  const eventDay = Date.parse(event.dateZ);
  if (!Number.isFinite(eventDay)) return [];
  const seen = new Set(event.sources.map(source => source.url));
  const perPublisher = new Map<string, number>();
  const citations: SourceAttribution[] = [];
  for (const article of articles) {
    const published = Date.parse(article.publishedAt);
    if (!Number.isFinite(published) || published < eventDay - 2 * 86_400_000
        || published > eventDay + 365 * 86_400_000) continue;
    const report = `${article.title} ${article.excerpt}`;
    if (!registrationPattern.test(report) || !ACCIDENT_CONTEXT.test(report) || seen.has(article.url)) continue;
    if ((perPublisher.get(article.publisher) ?? 0) >= 3) continue;
    seen.add(article.url);
    perPublisher.set(article.publisher, (perPublisher.get(article.publisher) ?? 0) + 1);
    citations.push({ sourceName: article.publisher, title: article.title, url: article.url,
      fetchedAt: new Date().toISOString() });
  }
  return citations;
}
