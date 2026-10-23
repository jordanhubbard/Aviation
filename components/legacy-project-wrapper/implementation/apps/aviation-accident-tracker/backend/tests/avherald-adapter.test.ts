/**
 * Unit tests for the AVHerald adapter (src/ingest/adapters/avHeraldAdapter.ts).
 *
 * This is the adapter the ingest pipeline actually uses; a parallel
 * class-based implementation used to live alongside it and carried the only
 * tests, so coverage moved here when that duplicate was removed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRecentAvHerald, parseAvHeraldRss } from '../src/ingest/adapters/avHeraldAdapter.js';

function rss(...items: string[]): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel>${items.join('')}</channel></rss>`;
}

function item(title: string, link: string, pubDate = 'Fri, 15 Mar 2024 12:00:00 GMT'): string {
  return `<item><title>${title}</title><link>${link}</link><pubDate>${pubDate}</pubDate></item>`;
}

const FEED = rss(
  item('Incident: Example A320 at London on Mar 15th 2024, engine shutdown', 'https://avherald.com/h?article=1'),
  item('Accident: Asia Air B789 at Tokyo on Mar 10th 2024, runway excursion', 'https://avherald.com/h?article=2')
);

describe('parseAvHeraldRss', () => {
  it('extracts every item from the feed', () => {
    expect(parseAvHeraldRss(FEED)).toHaveLength(2);
  });

  it('maps link to both id and url', () => {
    const [first] = parseAvHeraldRss(FEED);
    expect(first.url).toBe('https://avherald.com/h?article=1');
    expect(first.id).toBe(first.url);
  });

  it('tags the source and marks the record preliminary', () => {
    const [first] = parseAvHeraldRss(FEED);
    expect(first.source).toBe('avherald');
    expect(first.status).toBe('preliminary');
  });

  it('parses pubDate into an ISO timestamp', () => {
    const [first] = parseAvHeraldRss(FEED);
    expect(first.dateZ).toBe(new Date('Fri, 15 Mar 2024 12:00:00 GMT').toISOString());
  });

  it('uses the full title as summary and narrative', () => {
    const [first] = parseAvHeraldRss(FEED);
    expect(first.summary).toContain('engine shutdown');
    expect(first.narrative).toBe(first.summary);
  });

  it('derives the operator from the text before " at "', () => {
    const [, second] = parseAvHeraldRss(FEED);
    expect(second.operator).toBe('Accident: Asia Air B789');
  });

  it('extracts an aircraft type token from the title', () => {
    expect(parseAvHeraldRss(FEED)[0].aircraftType).toBeDefined();
  });

  it('falls back to UNKNOWN when no registration-like token is present', () => {
    const [only] = parseAvHeraldRss(rss(item('Report: an event', 'https://avherald.com/h?article=9')));
    expect(only.registration).toBe('UNKNOWN');
  });

  it('skips items missing a title or link', () => {
    const noLink = '<item><title>Incident: something</title></item>';
    expect(parseAvHeraldRss(rss(noLink))).toEqual([]);
  });

  it('returns [] for empty or non-RSS XML', () => {
    expect(parseAvHeraldRss('')).toEqual([]);
    expect(parseAvHeraldRss('<html><body>not rss</body></html>')).toEqual([]);
  });
});

describe('fetchRecentAvHerald', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed feed when the request succeeds', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(FEED, { status: 200 }));
    const events = await fetchRecentAvHerald();
    expect(events).toHaveLength(2);
    expect(events[0].source).toBe('avherald');
    expect(events[0].url).toBe('https://avherald.com/h?article=1');
  });

  it('caps the number of returned events', async () => {
    const many = rss(...Array.from({ length: 60 }, (_, i) => item(`Incident ${i}`, `https://avherald.com/h?article=${i}`)));
    vi.mocked(fetch).mockImplementation(async () => new Response(many, { status: 200 }));
    expect((await fetchRecentAvHerald()).length).toBeLessThanOrEqual(40);
  });

  // Outside production the adapter degrades to canned records rather than
  // failing the whole ingest run, so the pipeline stays exercisable offline.
  it('degrades to fallback records when the feed errors', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response('Not Found', { status: 404 }));
    const events = await fetchRecentAvHerald();
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.source === 'avherald')).toBe(true);
  });

  it('degrades to fallback records when the request throws', async () => {
    vi.mocked(fetch).mockImplementation(async () => { throw new Error('Network failure'); });
    expect((await fetchRecentAvHerald()).length).toBeGreaterThan(0);
  });

  it('degrades to fallback records when the feed has no items', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(rss(), { status: 200 }));
    expect((await fetchRecentAvHerald()).length).toBeGreaterThan(0);
  });
});
