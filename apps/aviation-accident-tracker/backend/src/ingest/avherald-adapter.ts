/**
 * AVHerald adapter
 * Fetches recent incidents from AVHerald feed
 */

import type { EventRecord, SourceAttribution } from '../types';
import type { SourceAdapter } from './adapter';
import { normalizeToUTC, isWithinRetentionWindow } from './adapter';
import { classifier } from '../classifier';
import { logger } from '../logger';

export class AVHeraldAdapter implements SourceAdapter {
  readonly sourceName = 'avherald';
  private baseUrl = 'https://avherald.com';
  
  async fetchRecent(windowDays: number): Promise<EventRecord[]> {
    logger.info('Fetching AVHerald recent incidents', { windowDays });
    
    try {
      // TODO: Implement actual AVHerald scraping/feed parsing
      // For now, return stub data
      logger.warn('AVHerald adapter not yet implemented - returning empty set');
      return [];
      
      // Future implementation:
      // 1. Fetch RSS/Atom feed or recent incidents page
      // 2. Parse feed/HTML
      // 3. Extract: date, registration, aircraft type, operator, location, summary
      // 4. Normalize dates to UTC
      // 5. Classify GA vs Commercial
      // 6. Filter >= 2000
      // 7. Return EventRecord array with sources
    } catch (error) {
      logger.error('AVHerald fetch failed', error as Error, { windowDays });
      throw error;
    }
  }
  
  /**
   * Parse AVHerald feed item to EventRecord
   * (Stub for future implementation)
   */
  private parseEvent(raw: any): EventRecord | null {
    try {
      // TODO: Implement parsing logic
      
      const dateZ = normalizeToUTC(raw.date);
      if (!isWithinRetentionWindow(dateZ)) {
        return null; // Skip pre-2000 events
      }
      
      const category = classifier.classify(raw.operator, raw.aircraftType);
      
      const source: SourceAttribution = {
        sourceName: this.sourceName,
        url: raw.url || `${this.baseUrl}/...`,
        fetchedAt: new Date().toISOString()
      };
      
      return {
        id: '', // Will be assigned by repository
        dateZ,
        registration: raw.registration,
        aircraftType: raw.aircraftType,
        operator: raw.operator,
        category,
        airportIcao: raw.airportIcao,
        airportIata: raw.airportIata,
        country: raw.country,
        region: raw.region,
        lat: raw.latitude,
        lon: raw.longitude,
        fatalities: raw.fatalities || 0,
        injuries: raw.injuries || 0,
        summary: raw.summary,
        narrative: raw.narrative,
        status: raw.status || 'preliminary',
        sources: [source],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to parse AVHerald event', error as Error, { raw });
      return null;
    }
  }
}
