/**
 * Ingestion orchestrator
 * Coordinates source adapters, handles dedupe/merge, and persists events
 */

import type { EventRecord } from '../types.js';
import type { SourceAdapter } from './adapter.js';
import { EventRepository } from '../db/repository.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { ASNAdapter } from './asn-adapter.js';
import { AVHeraldAdapter } from './avherald-adapter.js';

export interface IngestionResult {
  source: string;
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsIngested: number; // Total events ingested (created + updated)
  errors: number;
}

export class IngestionOrchestrator {
  private adapters: Map<string, SourceAdapter> = new Map();
  private repository: EventRepository;

  constructor(dbPath: string) {
    this.repository = new EventRepository(dbPath);
    
    // Register adapters
    this.registerAdapter(new ASNAdapter());
    this.registerAdapter(new AVHeraldAdapter());
  }

  private registerAdapter(adapter: SourceAdapter): void {
    this.adapters.set(adapter.sourceName, adapter);
    logger.info('Registered source adapter', { source: adapter.sourceName });
  }

  /**
   * Run ingestion for all sources or a specific source
   */
  async ingest(sourceName?: string, windowDays?: number): Promise<IngestionResult[]> {
    const window = windowDays || config.ingestion.windowDays;
    const sources = sourceName 
      ? [this.adapters.get(sourceName)]
      : Array.from(this.adapters.values());

    if (sourceName && !sources[0]) {
      throw new Error(`Unknown source: ${sourceName}`);
    }

    const results: IngestionResult[] = [];

    for (const adapter of sources) {
      if (!adapter) continue;
      
      const result = await this.ingestSource(adapter, window);
      results.push(result);
    }

    return results;
  }

  /**
   * Ingest from a single source with retries
   */
  private async ingestSource(adapter: SourceAdapter, windowDays: number): Promise<IngestionResult> {
    const result: IngestionResult = {
      source: adapter.sourceName,
      eventsProcessed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsIngested: 0,
      errors: 0
    };

    logger.info('Starting ingestion', { 
      source: adapter.sourceName, 
      windowDays 
    });

    try {
      // Fetch events from source with retries
      const events = await this.fetchWithRetry(adapter, windowDays);
      result.eventsProcessed = events.length;

      // Upsert each event (handles dedupe automatically)
      for (const event of events) {
        try {
          const existingId = await this.findExisting(event);
          const eventId = await this.repository.upsertEvent(event);
          
          if (existingId) {
            result.eventsUpdated++;
          } else {
            result.eventsCreated++;
          }

          // Add source attribution
          for (const source of event.sources) {
            await this.repository.addSource(eventId, source);
          }

          // Rate limiting
          await this.sleep(config.ingestion.rateLimitMs);

        } catch (error) {
          result.errors++;
          logger.error('Failed to upsert event', error as Error, { 
            source: adapter.sourceName,
            event: event.registration 
          });
        }
      }

      logger.info('Ingestion complete', result);
    } catch (error) {
      logger.error('Ingestion failed', error as Error, { 
        source: adapter.sourceName 
      });
      result.errors++;
    }

    // Calculate total ingested
    result.eventsIngested = result.eventsCreated + result.eventsUpdated;

    return result;
  }

  /**
   * Fetch events with exponential backoff retry
   */
  private async fetchWithRetry(adapter: SourceAdapter, windowDays: number): Promise<EventRecord[]> {
    const maxRetries = config.ingestion.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await adapter.fetchRecent(windowDays);
      } catch (error) {
        lastError = error as Error;
        logger.warn('Fetch attempt failed', { 
          source: adapter.sourceName,
          attempt,
          maxRetries,
          error: lastError.message
        });

        if (attempt < maxRetries) {
          const backoffMs = 1000 * Math.pow(2, attempt - 1);
          await this.sleep(backoffMs);
        }
      }
    }

    logger.error('All fetch attempts failed', lastError!, { 
      source: adapter.sourceName,
      maxRetries 
    });
    return []; // Return empty on failure rather than throwing
  }

  /**
   * Find existing event by (date_z, registration) or fuzzy match
   */
  private async findExisting(event: EventRecord): Promise<string | null> {
    // TODO: Implement fuzzy matching (date_z ± 1 day, country, aircraft_type)
    // For now, repository handles exact (date_z, registration) matching via upsert
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.repository.close();
  }
}
