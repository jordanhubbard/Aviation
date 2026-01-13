/**
 * ASN (Aviation Safety Network) adapter
 * Fetches recent accident occurrences
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
      // TODO: Implement actual ASN scraping/API
      // For now, return stub data
      logger.warn('ASN adapter not yet implemented - returning empty set');
      return [];
      
      // Future implementation:
      // 1. Fetch recent occurrences page
      // 2. Parse HTML or JSON (if available)
      // 3. Extract: date, registration, aircraft type, operator, location, summary, narrative
      // 4. Normalize dates to UTC
      // 5. Classify GA vs Commercial
      // 6. Filter >= 2000
      // 7. Return EventRecord array with sources
    } catch (error) {
      logger.error('ASN fetch failed', error as Error, { windowDays });
      throw error;
    }
  }
  
  /**
   * Parse ASN HTML/JSON to EventRecord
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
      logger.error('Failed to parse ASN event', error as Error, { raw });
      return null;
    }
  }
}
