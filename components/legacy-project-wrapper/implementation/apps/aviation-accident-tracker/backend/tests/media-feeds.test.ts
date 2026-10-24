import { describe, expect, it, vi } from 'vitest';
import { mediaCitations, parseMediaFeed, searchPublisherArticles } from '../src/ingest/mediaFeeds.js';
import type { NormalizedEvent } from '../src/ingest/types.js';

const xml = `<?xml version="1.0"?><rss><channel>
  <item><title><![CDATA[N744CJ crashes near airport]]></title>
    <link>https://avweb.com/accident/n744cj</link>
    <description><![CDATA[Local accident report]]></description>
    <pubDate>Wed, 21 Oct 2026 12:00:00 GMT</pubDate></item>
  <item><title>N744CJ maintenance in 2024</title>
    <link>https://avweb.com/old/n744cj</link>
    <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate></item>
  <item><title>N744CJ spoofed link</title>
    <link>http://example.com/insecure</link>
    <pubDate>Wed, 21 Oct 2026 12:00:00 GMT</pubDate></item>
</channel></rss>`;

const event = {
  dateZ: '2026-10-20T00:00:00Z', registration: 'N744CJ', sources: [],
} as unknown as NormalizedEvent;

describe('media feed citations', () => {
  it('keeps publisher headlines and verified HTTPS links matched to registration and date', () => {
    const articles = parseMediaFeed(xml, 'AVweb');
    expect(articles).toHaveLength(2);
    expect(mediaCitations(event, articles)).toEqual([expect.objectContaining({
      sourceName: 'AVweb', title: 'N744CJ crashes near airport',
      url: 'https://avweb.com/accident/n744cj',
    })]);
  });

  it('does not associate unknown or partial registrations', () => {
    const articles = parseMediaFeed(xml, 'AVweb');
    expect(mediaCitations({ ...event, registration: 'UNKNOWN' }, articles)).toEqual([]);
    expect(mediaCitations({ ...event, registration: 'N744C' }, articles)).toEqual([]);
  });

  it('accepts publisher archive results only when their article text names the aircraft', async () => {
    const response = JSON.stringify([{ date: '2026-10-21T12:00:00',
      link: 'https://www.aerotime.aero/articles/n744cj',
      title: { rendered: 'Airport crash under investigation' },
      content: { rendered: '<p>Aircraft N744CJ was involved.</p>' } }]);
    const request = vi.fn(async (url: URL) => new Response(url.hostname === 'www.aerotime.aero' ? response : '[]'));
    vi.stubGlobal('fetch', request);
    try {
      const articles = await searchPublisherArticles('N744CJ');
      expect(mediaCitations(event, articles)).toEqual([expect.objectContaining({
        sourceName: 'AeroTime', url: 'https://www.aerotime.aero/articles/n744cj',
      })]);
      expect(request).toHaveBeenCalledTimes(4);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
