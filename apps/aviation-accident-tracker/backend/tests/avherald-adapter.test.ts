/**
 * Unit tests for AVHeraldAdapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AVHeraldAdapter } from '../src/ingest/avherald-adapter';

const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Aviation Herald</title>
    <link>https://avherald.com</link>
    <item>
      <title><![CDATA[Incident: Boeing 737-800, registration D-ABCD, near Frankfurt on 15 Mar 2024]]></title>
      <link>https://avherald.com/h?article=abc123</link>
      <pubDate>Fri, 15 Mar 2024 10:00:00 +0000</pubDate>
      <description><![CDATA[A Boeing 737-800 experienced a technical issue near Frankfurt.]]></description>
    </item>
    <item>
      <title>Accident: Cessna 172, registration N98765, near Los Angeles on 10 Mar 2024</title>
      <link>https://avherald.com/h?article=def456</link>
      <pubDate>Sun, 10 Mar 2024 08:30:00 +0000</pubDate>
      <description>A Cessna 172 made a forced landing.</description>
    </item>
    <item>
      <title>Incident: Airbus A320, no registration given</title>
      <link>https://avherald.com/h?article=ghi789</link>
      <pubDate>Mon, 01 Mar 2024 12:00:00 +0000</pubDate>
      <description>Brief incident description.</description>
    </item>
  </channel>
</rss>`;

describe('AVHeraldAdapter', () => {
  let adapter: AVHeraldAdapter;

  beforeEach(() => {
    adapter = new AVHeraldAdapter();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('parseRss', () => {
    it('extracts all items from RSS feed', () => {
      const items = adapter.parseRss(MOCK_RSS);
      expect(items).toHaveLength(3);
    });

    it('extracts registration from CDATA title', () => {
      const items = adapter.parseRss(MOCK_RSS);
      expect(items[0].registration).toBe('D-ABCD');
    });

    it('extracts registration from plain-text title', () => {
      const items = adapter.parseRss(MOCK_RSS);
      expect(items[1].registration).toBe('N98765');
    });

    it('leaves registration undefined when not present in title', () => {
      const items = adapter.parseRss(MOCK_RSS);
      expect(items[2].registration).toBeUndefined();
    });

    it('extracts aircraft type from title prefix', () => {
      const items = adapter.parseRss(MOCK_RSS);
      expect(items[0].aircraftType).toBe('Boeing 737-800');
      expect(items[1].aircraftType).toBe('Cessna 172');
    });

    it('extracts pubDate', () => {
      const items = adapter.parseRss(MOCK_RSS);
      expect(items[0].date).toContain('2024');
    });

    it('sets summary to the full title', () => {
      const items = adapter.parseRss(MOCK_RSS);
      expect(items[0].summary).toContain('Boeing 737-800');
    });

    it('returns [] for empty or non-RSS XML', () => {
      expect(adapter.parseRss('')).toEqual([]);
      expect(adapter.parseRss('<feed><entry></entry></feed>')).toEqual([]);
    });
  });

  describe('fetchRecent', () => {
    it('returns [] when feed returns 404', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Not Found', { status: 404 })
      );
      const result = await adapter.fetchRecent(30);
      expect(result).toEqual([]);
    });

    it('returns [] when fetch throws', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await adapter.fetchRecent(30);
      expect(result).toEqual([]);
    });

    it('returns [] when feed XML has no items', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('<rss><channel></channel></rss>', { status: 200 })
      );
      const result = await adapter.fetchRecent(30);
      expect(result).toEqual([]);
    });

    it('returns parsed EventRecords for valid feed within window', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(MOCK_RSS, { status: 200 })
      );
      // Large window so all 2024 dates pass
      const result = await adapter.fetchRecent(3650);
      expect(result.length).toBe(3);
      expect(result[0].sourceName ?? result[0].sources[0].sourceName).toBe('avherald');
      expect(result[0].registration).toBe('D-ABCD');
    });

    it('filters out events outside the windowDays cutoff', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(MOCK_RSS, { status: 200 })
      );
      // 1-day window: all 2024 dates excluded
      const result = await adapter.fetchRecent(1);
      expect(result).toEqual([]);
    });

    it('sets narrative from RSS description', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(MOCK_RSS, { status: 200 })
      );
      const result = await adapter.fetchRecent(3650);
      expect(result[0].narrative).toContain('technical issue');
    });
  });
});
