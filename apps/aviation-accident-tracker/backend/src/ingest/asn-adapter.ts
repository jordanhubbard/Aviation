/**
 * ASN (Aviation Safety Network) adapter
 * Fetches recent accident occurrences with graceful degradation.
 * ASN does not expose a public authenticated API; this adapter attempts
 * to scrape the public database page. On any failure (403, 429, parse
 * errors, network timeouts) it logs a warning and returns [].
 */

import type { EventRecord, SourceAttribution } from '../types.js';
import type { SourceAdapter } from './adapter.js';
import { normalizeToUTC, isWithinRetentionWindow } from './adapter.js';
import { classifier } from '../classifier.js';
import { logger } from '../logger.js';

export class ASNAdapter implements SourceAdapter {
  readonly sourceName = 'asn';
  private baseUrl = 'https://aviation-safety.net';

  async fetchRecent(windowDays: number): Promise<EventRecord[]> {
    logger.info('Fetching ASN recent occurrences', { windowDays });

    try {
      const response = await fetch(`${this.baseUrl}/database/`, {
        headers: { 'User-Agent': 'AviationTracker/1.0 (safety research)' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        logger.warn('ASN returned non-OK status, returning empty set', {
          status: response.status,
          windowDays,
        });
        return [];
      }

      const html = await response.text();
      const rawEvents = this.extractEventsFromHtml(html);

      if (rawEvents.length === 0) {
        logger.warn('ASN: no parseable events found in response, returning empty set');
        return [];
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - windowDays);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      return rawEvents
        .map(raw => this.parseEvent(raw))
        .filter((e): e is EventRecord => e !== null && e.dateZ >= cutoffStr);
    } catch (error) {
      logger.warn('ASN fetch failed, returning empty set', {
        windowDays,
        message: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Extract rows from ASN database HTML page.
   * The page contains a datatable with columns: date, type, registration,
   * operator, fatalities, location.
   */
  private extractEventsFromHtml(html: string): any[] {
    const rows: any[] = [];

    // ASN database page wraps accident rows in a table with class "datatable"
    const tableMatch = html.match(
      /<table[^>]*class="[^"]*datatable[^"]*"[^>]*>([\s\S]*?)<\/table>/i
    );
    if (!tableMatch) return [];

    const getText = (cell: string) => cell.replace(/<[^>]+>/g, '').trim();
    const getHref = (cell: string): string | undefined => {
      const m = cell.match(/href="([^"]+)"/);
      if (!m) return undefined;
      return m[1].startsWith('http') ? m[1] : `${this.baseUrl}${m[1]}`;
    };

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableMatch[1])) !== null) {
      const cells = rowMatch[1].match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? [];
      if (cells.length < 4) continue;

      rows.push({
        date: getText(cells[0]),
        aircraftType: getText(cells[1]),
        registration: getText(cells[2]),
        operator: getText(cells[3]),
        fatalities: cells[4] ? parseInt(getText(cells[4]), 10) || 0 : 0,
        location: cells[5] ? getText(cells[5]) : undefined,
        summary: `${getText(cells[1])} - ${getText(cells[3])}`,
        url: getHref(cells[0]),
      });
    }

    return rows;
  }

  /**
   * Map a raw scraped row to EventRecord.
   */
  private parseEvent(raw: any): EventRecord | null {
    try {
      const dateZ = normalizeToUTC(raw.date);
      if (!isWithinRetentionWindow(dateZ)) {
        return null;
      }

      const category = classifier.classify(raw.operator, raw.aircraftType);

      const source: SourceAttribution = {
        sourceName: this.sourceName,
        url: raw.url ?? `${this.baseUrl}/database/`,
        fetchedAt: new Date().toISOString(),
      };

      return {
        id: '',
        dateZ,
        registration: raw.registration,
        aircraftType: raw.aircraftType,
        operator: raw.operator,
        category,
        airportIcao: undefined,
        airportIata: undefined,
        country: raw.location,
        region: undefined,
        lat: undefined,
        lon: undefined,
        fatalities: raw.fatalities ?? 0,
        injuries: 0,
        summary: raw.summary,
        narrative: undefined,
        status: 'preliminary',
        sources: [source],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to parse ASN event', error as Error, { raw });
      return null;
    }
  }
}
