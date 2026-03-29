/**
 * AVHerald adapter
 * Fetches recent incidents from the AVHerald RSS feed.
 * Gracefully degrades to [] if the feed is unavailable or unparseable.
 */

import type { EventRecord, SourceAttribution } from '../types.js';
import type { SourceAdapter } from './adapter.js';
import { normalizeToUTC, isWithinRetentionWindow } from './adapter.js';
import { classifier } from '../classifier.js';
import { logger } from '../logger.js';

export class AVHeraldAdapter implements SourceAdapter {
  readonly sourceName = 'avherald';
  private baseUrl = 'https://avherald.com';

  async fetchRecent(windowDays: number): Promise<EventRecord[]> {
    logger.info('Fetching AVHerald recent incidents', { windowDays });

    try {
      const response = await fetch(`${this.baseUrl}/h?subscribed=1`, {
        headers: {
          'User-Agent': 'AviationTracker/1.0 (safety research)',
          Accept: 'application/rss+xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        logger.warn('AVHerald RSS returned non-OK status, returning empty set', {
          status: response.status,
          windowDays,
        });
        return [];
      }

      const xml = await response.text();
      const rawItems = this.parseRss(xml);

      if (rawItems.length === 0) {
        logger.warn('AVHerald: no parseable items in RSS feed, returning empty set');
        return [];
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - windowDays);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      return rawItems
        .map(raw => this.parseEvent(raw))
        .filter((e): e is EventRecord => e !== null && e.dateZ >= cutoffStr);
    } catch (error) {
      logger.warn('AVHerald fetch failed, returning empty set', {
        windowDays,
        message: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Parse RSS/Atom XML and return an array of raw item objects.
   * Uses regex extraction — no external XML library required.
   */
  parseRss(xml: string): any[] {
    const items: any[] = [];

    // Extract each <item> block
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];

      const getTag = (tag: string): string => {
        // Support both plain text and CDATA sections
        const re = new RegExp(
          `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${tag}>`,
          'i'
        );
        const m = block.match(re);
        return (m ? (m[1] ?? m[2] ?? '') : '').trim();
      };

      const title = getTag('title');
      if (!title) continue;

      const link = getTag('link');
      const pubDate = getTag('pubDate');
      const description = getTag('description');

      // AVHerald title format examples:
      //   "Incident: Boeing 737-800, registration D-ABCD, near Frankfurt on 25 Mar 2026"
      //   "Accident: Cessna 172, registration N12345, ..."
      // Match uppercase registration codes (N12345, D-ABCD, G-XYZW, etc.)
      const regMatch = title.match(/registration\s+([A-Z][A-Z0-9-]{2,})/);
      const typeMatch = title.match(/^(?:Incident|Accident|Crash|Emergency|Report|NOTAM):\s*([^,]+)/i);

      items.push({
        title,
        description,
        url: link || undefined,
        date: pubDate || undefined,
        registration: regMatch ? regMatch[1] : undefined,
        aircraftType: typeMatch ? typeMatch[1].trim() : undefined,
        summary: title,
      });
    }

    return items;
  }

  /**
   * Map a raw RSS item to EventRecord.
   */
  private parseEvent(raw: any): EventRecord | null {
    try {
      const dateZ = normalizeToUTC(raw.date);
      if (!isWithinRetentionWindow(dateZ)) {
        return null;
      }

      const category = classifier.classify(undefined, raw.aircraftType);

      const source: SourceAttribution = {
        sourceName: this.sourceName,
        url: raw.url ?? this.baseUrl,
        fetchedAt: new Date().toISOString(),
      };

      return {
        id: '',
        dateZ,
        registration: raw.registration,
        aircraftType: raw.aircraftType,
        operator: undefined,
        category,
        airportIcao: undefined,
        airportIata: undefined,
        country: undefined,
        region: undefined,
        lat: undefined,
        lon: undefined,
        fatalities: 0,
        injuries: 0,
        summary: raw.summary,
        narrative: raw.description || undefined,
        status: 'preliminary',
        sources: [source],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to parse AVHerald event', error as Error, { raw });
      return null;
    }
  }
}
