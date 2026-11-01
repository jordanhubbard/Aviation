import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createE2ERunId } from '@aviation/shared-sdk/e2e';
import { EventRepository } from '../src/db/repository.js';
import sqlite3 from 'sqlite3';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('persisted ingest fuzzy matching', () => {
  let repo: EventRepository;
  beforeEach(async () => { repo = new EventRepository(':memory:'); await repo.initialize(); });
  afterEach(async () => { await repo.close(); });
  const candidateDate = '2026-01-02T00:01:00Z';
  const seed = (registration: string, dateZ: string, country?: string, aircraftType?: string) =>
    repo.upsertEvent({ registration, dateZ, country, aircraftType, category: 'general' });

  it.each(['2026-01-01T00:00:00Z', '2026-01-03T23:59:59Z', '2026-01-01']) (
    'includes the entire adjacent UTC day: %s', async date => {
      const id = await seed('N123', date, 'US', 'Cessna 172 Skyhawk');
      expect(await repo.findFuzzyEvent(candidateDate, ' us ', 'CESSNA   172 SP', 'UNKNOWN')).toBe(id);
    });

  it('rejects dates outside the window and requires contextual evidence', async () => {
    await seed('N123', '2026-01-04T00:00:00Z', 'US', 'Cessna 172');
    expect(await repo.findFuzzyEvent(candidateDate, 'US', 'Cessna 172')).toBeNull();
    await seed('N456', candidateDate, 'US', 'Cessna 172');
    expect(await repo.findFuzzyEvent(candidateDate)).toBeNull();
    for (const bad of ['invalid', '2026-02-30T12:00:00Z', "' OR 1=1 --"]) {
      expect(await repo.findFuzzyEvent(bad, 'US')).toBeNull();
    }
    expect(await repo.findFuzzyEvent(candidateDate, "US' OR 1=1 --")).toBeNull();
    expect((await repo.listEvents({})).total).toBe(2);
  });

  it('selects a unique best score and rejects ties', async () => {
    await seed('N1', candidateDate, 'US');
    const id = await seed('N2', candidateDate, 'US', 'Cessna 172');
    expect(await repo.findFuzzyEvent(candidateDate, 'US', 'Cessna 172')).toBe(id);
    await seed('N3', candidateDate, 'US', 'Cessna 172');
    expect(await repo.findFuzzyEvent(candidateDate, 'US', 'Cessna 172')).toBeNull();
  });

  it('rejects contradictory registrations, countries and types', async () => {
    const id = await seed('N-123AB', candidateDate, 'US', 'Cessna 172');
    expect(await repo.findFuzzyEvent(candidateDate, 'US', 'Cessna 172', 'N123AB')).toBe(id);
    expect(await repo.findFuzzyEvent(candidateDate, 'US', 'Cessna 172', 'N999XX')).toBeNull();
    expect(await repo.findFuzzyEvent(candidateDate, 'CA', 'Cessna 172')).toBeNull();
    expect(await repo.findFuzzyEvent(candidateDate, 'US', 'Boeing 737')).toBeNull();
    expect(await repo.findFuzzyEvent(candidateDate, 'US', undefined, 'N/A')).toBe(id);
  });

  it('does not use run-tagged test records as production match candidates', async () => {
    const runId = createE2ERunId();
    await repo.seedTestEvent(runId, { is_test_data: true, test_run_id: runId,
      registration: 'NTEST', dateZ: candidateDate, country: 'US', aircraftType: 'Cessna 172' });
    expect(await repo.findFuzzyEvent(candidateDate, 'US', 'Cessna 172')).toBeNull();
    expect(await repo.findEventId(candidateDate, 'NTEST')).toBeNull();
  });

  it('updates the matched row without clearing existing evidence or moving its key', async () => {
    const id = await repo.upsertEvent({ registration: 'N123', dateZ: candidateDate,
      country: 'US', aircraftType: 'Cessna 172', summary: 'Original report', fatalities: 2,
      category: 'general' });
    expect(await repo.upsertEvent({ registration: 'UNKNOWN', dateZ: '2026-01-03T00:00:00Z',
      category: 'unknown', narrative: 'Additional evidence' }, id)).toBe(id);
    const event = await repo.getEventWithSources(id);
    expect(event).toMatchObject({ registration: 'N123', dateZ: candidateDate, fatalities: 2,
      category: 'general', summary: 'Original report', narrative: 'Additional evidence' });
    await expect(repo.upsertEvent({ registration: 'N123', dateZ: candidateDate }, '99999')).rejects.toThrow();
    expect((await repo.listEvents({})).total).toBe(1);
  });
});

async function withLegacyDatabase(extra: string, check: (repo: EventRepository,
  query: (sql: string) => Promise<any[]>) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'aviation-identity-migration-'));
  const path = join(directory, 'events.sqlite');
  const db = new sqlite3.Database(path);
  const exec = (sql: string) => new Promise<void>((resolve, reject) =>
    db.exec(sql, error => error ? reject(error) : resolve()));
  const query = (sql: string) => new Promise<any[]>((resolve, reject) =>
    db.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
  let repo: EventRepository | undefined;
  try {
    const schema = await readFile(new URL('../src/db/schema.sql', import.meta.url), 'utf8');
    // Reproduce the former table-wide constraint, including dependent objects.
    await exec(schema.replace('CHECK((is_test_data = 0', 'UNIQUE(date_z, registration),\n    CHECK((is_test_data = 0'));
    await exec(`
      PRAGMA foreign_keys = ON;
      INSERT INTO events(id, date_z, registration, country, aircraft_type, summary)
      VALUES (7, '2026-01-02T00:00:00Z', 'N123', 'US', 'Cessna 172', 'original'),
             (8, '2026-01-02T00:00:00Z', 'UNKNOWN', 'Canada', 'Boeing 737', 'unidentified'),
             (99, '2026-01-01T00:00:00Z', 'NDELETED', 'US', 'Cessna 172', 'deleted');
      DELETE FROM events WHERE id = 99;
      INSERT INTO sources(id, event_id, source_name, url) VALUES(11, 7, 'original-source', 'https://example.invalid/original');
      INSERT INTO causes(event_id, label, source_name, url, basis) VALUES(7, 'reported cause', 'original-source', 'https://example.invalid/cause', 'reported');
      INSERT INTO media_checks(event_id, checked_at) VALUES(7, '2026-01-02T00:00:00Z');
      INSERT INTO source_identities(source_name, record_id, event_id) VALUES('ntsb', 'legacy-case', 7);
      CREATE INDEX preserved_summary_index ON events(summary);
      CREATE VIEW preserved_event_view AS SELECT id, summary FROM events;
      CREATE TABLE preserved_audit(event_id INTEGER);
      CREATE TRIGGER preserved_event_trigger AFTER UPDATE ON events BEGIN INSERT INTO preserved_audit VALUES(NEW.id); END;
      ${extra}
    `);
    repo = new EventRepository(path);
    await check(repo, query);
  } finally {
    if (repo) await repo.close();
    await new Promise<void>((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}

describe('legacy event identity migration', () => {
  it('preserves event IDs, provenance, objects and AUTOINCREMENT while separating unidentified reports', async () => {
    await withLegacyDatabase('', async (repo, query) => {
      await repo.initialize();
      await repo.initialize(); // Idempotent after the one-time constraint transition.
      const original = await repo.getEventWithSources('7');
      expect(original?.sources[0]).toMatchObject({ sourceName: 'original-source', url: 'https://example.invalid/original' });
      expect(original?.causes?.[0].label).toBe('reported cause');
      expect(await repo.findEventIdBySource({ sourceName: 'ntsb', recordId: 'legacy-case' }, 'N123')).toBe('7');
      expect(await query('SELECT event_id FROM media_checks')).toEqual([{ event_id: 7 }]);
      const id = await repo.upsertEvent({ registration: 'UNKNOWN', dateZ: '2026-01-02T00:00:00Z', country: 'US' });
      expect(Number(id)).toBeGreaterThan(99);
      expect((await repo.listEvents({})).total).toBe(3);
      expect((await repo.getEventWithSources('8'))?.summary).toBe('unidentified');
      await repo.upsertEvent({ registration: 'N123', dateZ: '2026-01-02T00:00:00Z', summary: 'updated' });
      expect(await query('SELECT * FROM preserved_audit')).toEqual([{ event_id: 7 }]);
      expect(await query('SELECT summary FROM preserved_event_view WHERE id = 7')).toEqual([{ summary: 'updated' }]);
      expect((await query('PRAGMA index_list(events)')).some(row => row.name === 'preserved_summary_index')).toBe(true);
      expect(await query('PRAGMA foreign_key_check')).toEqual([]);
    });
  });

  it('rolls back a schema transition that would discard an unknown column', async () => {
    await withLegacyDatabase("ALTER TABLE events ADD COLUMN retained_note TEXT; UPDATE events SET retained_note = 'keep me' WHERE id = 7;", async (repo, query) => {
      await expect(repo.initialize()).rejects.toThrow('unrecognized columns');
      expect(await query('SELECT retained_note FROM events WHERE id = 7')).toEqual([{ retained_note: 'keep me' }]);
      expect(await query('SELECT id FROM sources')).toEqual([{ id: 11 }]);
      expect(await query("SELECT name FROM sqlite_master WHERE name = 'events_identity_migration'")).toEqual([]);
    });
  });
});
