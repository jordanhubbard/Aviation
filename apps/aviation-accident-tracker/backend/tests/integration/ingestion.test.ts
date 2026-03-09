// apps/aviation-accident-tracker/backend/tests/integration/ingestion.test.ts

import { describe, test, expect, beforeEach } from 'vitest';
import { ASNAdapter } from '../../src/ingest/asn-adapter.js';
import { AVHeraldAdapter } from '../../src/ingest/avherald-adapter.js';
import { IngestionOrchestrator } from '../../src/ingest/orchestrator.js';
import { EventRepository } from '../../src/db/repository.js';

describe('Data Ingestion Integration', () => {
  let repository: EventRepository;
  let orchestrator: IngestionOrchestrator;

  beforeEach(async () => {
    repository = new EventRepository();
    await repository.initialize();
    orchestrator = new IngestionOrchestrator(repository);
  });

  describe('ASN Adapter', () => {
    test('fetches and parses real data', async () => {
      const adapter = new ASNAdapter();
      const events = await adapter.fetch(7); // Last 7 days

      expect(Array.isArray(events)).toBe(true);
      
      if (events.length > 0) {
        const event = events[0];
        expect(event).toHaveProperty('external_id');
        expect(event.external_id).toMatch(/^asn-/);
        expect(event).toHaveProperty('source', 'ASN');
        expect(event).toHaveProperty('date_time');
        expect(event).toHaveProperty('aircraft_type');
      }
    }, 30000); // 30s timeout for network requests
  });

  describe('AVHerald Adapter', () => {
    test('fetches and parses real data', async () => {
      const adapter = new AVHeraldAdapter();
      const events = await adapter.fetch(7);

      expect(Array.isArray(events)).toBe(true);
      
      if (events.length > 0) {
        const event = events[0];
        expect(event).toHaveProperty('external_id');
        expect(event.external_id).toMatch(/^avherald-/);
        expect(event).toHaveProperty('source', 'AVHerald');
        expect(event).toHaveProperty('date_time');
        expect(event).toHaveProperty('aircraft_type');
      }
    }, 30000); // 30s timeout for network requests
  });

  describe('Ingestion Orchestrator', () => {
    test('orchestrates ingestion from all sources', async () => {
      const result = await orchestrator.runIngestion(7);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('totalEventsIngested');
      expect(result.totalEventsIngested).toBeGreaterThan(0);
    });
  });
});
