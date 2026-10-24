import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventRepository } from '../src/db/repository.js';

describe('media attribution persistence', () => {
  it('migrates an existing source table and retains article titles across searches', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'aviation-media-'));
    const path = join(dir, 'events.db');
    const old = new sqlite3.Database(path);
    await new Promise<void>((resolve, reject) => old.run(
      'CREATE TABLE sources (id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL, source_name TEXT NOT NULL, url TEXT NOT NULL, fetched_at TEXT NOT NULL, checksum TEXT, raw_fragment TEXT, created_at TEXT)',
      error => error ? reject(error) : resolve()));
    await new Promise<void>((resolve, reject) => old.close(error => error ? reject(error) : resolve()));

    const repository = new EventRepository(path);
    try {
      await repository.initialize();
      const eventId = await repository.upsertEvent({ dateZ: new Date().toISOString(), registration: 'N744CJ' });
      await repository.addSource(eventId, { sourceName: 'AVweb', title: 'Accident report',
        url: 'https://avweb.com/report', fetchedAt: new Date().toISOString() });
      await repository.addCause(eventId, { label: 'Engine failure', sourceName: 'AVweb',
        url: 'https://avweb.com/report', basis: 'reported' });
      await repository.addCause(eventId, { label: 'Loss of control', sourceName: 'NTSB event sequence',
        url: 'https://data.ntsb.gov/update.zip', basis: 'occurrence' });
      await repository.addCause(eventId, { label: 'Loss of control', sourceName: 'NTSB',
        url: 'https://data.ntsb.gov/update.zip', basis: 'official' });
      await repository.addCause(eventId, { label: 'Engine failure', sourceName: 'AVweb',
        url: 'https://avweb.com/report', basis: 'reported' });
      expect((await repository.getEventWithSources(eventId))?.sources).toEqual([
        expect.objectContaining({ sourceName: 'AVweb', title: 'Accident report' }),
      ]);
      expect((await repository.listEvents({})).events[0].causes).toEqual([
        { label: 'Loss of control', sourceName: 'NTSB', url: 'https://data.ntsb.gov/update.zip', basis: 'official' },
        { label: 'Engine failure', sourceName: 'AVweb', url: 'https://avweb.com/report', basis: 'reported' },
      ]);
      expect((await repository.listEvents({})).events[0].sources).toEqual([
        expect.objectContaining({ sourceName: 'AVweb', title: 'Accident report' }),
      ]);
      expect((await repository.listEvents({ cause: 'Engine failure' })).total).toBe(1);
      expect((await repository.listEvents({ cause: 'CFIT' })).total).toBe(0);
      expect((await repository.getIngestStatus()).lastSuccessAt).toBeNull();
      await repository.recordIngestStart();
      await repository.recordIngestResult({ inserted: 1, updated: 0 });
      expect((await repository.getIngestStatus()).lastSuccessAt).toMatch(/^\d{4}-\d\d-\d\dT/);
      await repository.recordIngestStart();
      await repository.recordIngestResult({ inserted: 0, updated: 0 }, 'network unavailable');
      expect((await repository.getIngestStatus()).lastError).toBe('network unavailable');
      expect((await repository.getIngestStatus()).lastSuccessAt).toMatch(/^\d{4}-\d\d-\d\dT/);
      expect((await repository.listEventsNeedingMediaSearch(10)).map(event => event.id)).toContain(eventId);
      await repository.markMediaSearched(eventId);
      expect((await repository.listEventsNeedingMediaSearch(10)).map(event => event.id)).not.toContain(eventId);
    } finally {
      await repository.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
