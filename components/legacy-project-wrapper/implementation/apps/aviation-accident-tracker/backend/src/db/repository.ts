/**
 * Repository layer for aviation accident tracker
 * Handles database operations with upsert logic based on (date_z, registration)
 * Converts between snake_case DB columns and camelCase TypeScript types
 */

import sqlite3 from 'sqlite3';
const { Database } = sqlite3;
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import type { EventRecord, SourceAttribution, CauseAttribution, ListEventsParams, Category } from '../types.js';
import { assertTestDataForRun, type E2ERunId } from '@aviation/shared-sdk/e2e';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DbEvent {
  id: number;
  date_z: string;
  registration: string;
  aircraft_type?: string;
  operator?: string;
  category: Category;
  airport_icao?: string;
  airport_iata?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  region?: string;
  fatalities: number;
  injuries: number;
  summary?: string;
  narrative?: string;
  status?: string;
  created_at: string;
  updated_at: string;
}

interface DbSource {
  id: number;
  event_id: number;
  source_name: string;
  title?: string;
  url: string;
  fetched_at: string;
  checksum?: string;
  raw_fragment?: string;
  created_at: string;
}

export class EventRepository {
  private db: sqlite3.Database;
  private dbRun: (sql: string, params?: any[]) => Promise<{ lastID: number; changes: number }>;
  private dbGet: (sql: string, params?: any[]) => Promise<any>;
  private dbAll: (sql: string, params?: any[]) => Promise<any[]>;
  private dbExec: (sql: string) => Promise<void>;

  constructor(dbPath?: string) {
    // sqlite will not create missing parent directories, so a fresh checkout
    // fails with SQLITE_CANTOPEN before the server can start.
    if (dbPath && dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath || ':memory:');
    this.dbRun = (sql, params = []) =>
      new Promise((resolve, reject) => {
        this.db.run(sql, params, function (err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({ lastID: this.lastID ?? 0, changes: this.changes ?? 0 });
        });
      });
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
    this.dbExec = promisify(this.db.exec.bind(this.db));
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    // Point to source directory even when running from dist
    const schemaPath = path.join(__dirname, '../../src/db/schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');
    
    await this.dbExec(schema);
    // CREATE TABLE IF NOT EXISTS leaves preexisting deployments at the old shape.
    const columns: { name: string }[] = await this.dbAll('PRAGMA table_info(sources)');
    if (!columns.some(column => column.name === 'title')) {
      await this.dbExec('ALTER TABLE sources ADD COLUMN title TEXT');
    }
    if (!columns.some(column => column.name === 'is_test_data')) {
      await this.dbExec('ALTER TABLE sources ADD COLUMN is_test_data INTEGER NOT NULL DEFAULT 0');
    }
    if (!columns.some(column => column.name === 'test_run_id')) {
      await this.dbExec('ALTER TABLE sources ADD COLUMN test_run_id TEXT');
    }
    const eventColumns: { name: string }[] = await this.dbAll('PRAGMA table_info(events)');
    if (!eventColumns.some(column => column.name === 'is_test_data')) {
      await this.dbExec('ALTER TABLE events ADD COLUMN is_test_data INTEGER NOT NULL DEFAULT 0');
    }
    if (!eventColumns.some(column => column.name === 'test_run_id')) {
      await this.dbExec('ALTER TABLE events ADD COLUMN test_run_id TEXT');
    }
    await this.dbExec('CREATE INDEX IF NOT EXISTS idx_events_test_run ON events(test_run_id) WHERE is_test_data = 1');
    await this.dbExec('CREATE INDEX IF NOT EXISTS idx_sources_test_run ON sources(test_run_id) WHERE is_test_data = 1');
  }

  async seedTestEvent(runId: E2ERunId, value: unknown): Promise<string> {
    assertTestDataForRun(value, runId);
    const event = value as unknown as Partial<EventRecord> & { dateZ: string; registration: string };
    if (typeof event.dateZ !== 'string' || !/^20\d\d-\d\d-\d\dT/.test(event.dateZ)
      || typeof event.registration !== 'string' || !/^[A-Z0-9-]{2,16}$/.test(event.registration)) {
      throw new Error('Invalid E2E accident fixture');
    }
    for (const source of event.sources ?? []) {
      if (source.sourceName !== 'e2e-fixture'
        || !source.url.startsWith(`https://example.invalid/e2e/${runId}`)) {
        throw new Error('E2E source must use the inert fixture URL');
      }
    }
    await this.dbRun('INSERT OR IGNORE INTO e2e_runs (run_id, is_test_data) VALUES (?, 1)', [runId]);
    const result = await this.dbRun(
      `INSERT INTO events (date_z, registration, aircraft_type, category, country, region,
         latitude, longitude, summary, status, is_test_data, test_run_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [event.dateZ, event.registration, event.aircraftType ?? 'CESSNA 172',
        event.category ?? 'general', event.country ?? 'USA', event.region ?? 'CA',
        event.lat ?? null, event.lon ?? null,
        event.summary ?? 'Synthetic E2E event', event.status ?? 'reported', runId]
    );
    const id = String(result.lastID);
    for (const source of event.sources ?? []) {
      await this.dbRun(`INSERT INTO sources (event_id, source_name, title, url, fetched_at,
        is_test_data, test_run_id) VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [Number(id), source.sourceName, source.title ?? null, source.url, source.fetchedAt, runId]);
    }
    return id;
  }

  async countTestEvents(runId: E2ERunId): Promise<number> {
    const row = await this.dbGet(`SELECT
      (SELECT COUNT(*) FROM events WHERE is_test_data = 1 AND test_run_id = ?) +
      (SELECT COUNT(*) FROM sources WHERE is_test_data = 1 AND test_run_id = ?) AS count`, [runId, runId]);
    return Number(row?.count ?? 0);
  }

  /**
   * Convert DB row to EventRecord type
   */
  private dbEventToRecord(dbEvent: DbEvent, sources: SourceAttribution[] = [], causes: CauseAttribution[] = []): EventRecord {
    return {
      id: String(dbEvent.id),
      dateZ: dbEvent.date_z,
      registration: dbEvent.registration,
      aircraftType: dbEvent.aircraft_type,
      operator: dbEvent.operator,
      category: dbEvent.category,
      airportIcao: dbEvent.airport_icao,
      airportIata: dbEvent.airport_iata,
      country: dbEvent.country,
      region: dbEvent.region,
      lat: dbEvent.latitude,
      lon: dbEvent.longitude,
      fatalities: dbEvent.fatalities,
      injuries: dbEvent.injuries,
      summary: dbEvent.summary,
      narrative: dbEvent.narrative,
      status: dbEvent.status,
      causes,
      sources,
      createdAt: dbEvent.created_at,
      updatedAt: dbEvent.updated_at
    };
  }

  /**
   * Convert DB source to SourceAttribution
   */
  private dbSourceToAttribution(dbSource: DbSource): SourceAttribution {
    return {
      sourceName: dbSource.source_name,
      title: dbSource.title,
      url: dbSource.url,
      fetchedAt: dbSource.fetched_at,
      checksum: dbSource.checksum
    };
  }

  /**
   * Upsert event based on (date_z, registration) uniqueness key
   * If event exists, updates fields. If not, inserts new record.
   */
  async upsertEvent(event: Partial<EventRecord> & { dateZ: string; registration: string }): Promise<string> {
    // Check if event exists
    const existing = await this.dbGet(
      'SELECT id FROM events WHERE date_z = ? AND registration = ?',
      [event.dateZ, event.registration]
    );

    if (existing) {
      // Update existing event
      await this.dbRun(
        `UPDATE events SET
          aircraft_type = ?,
          operator = ?,
          category = ?,
          airport_icao = ?,
          airport_iata = ?,
          latitude = ?,
          longitude = ?,
          country = ?,
          region = ?,
          fatalities = ?,
          injuries = ?,
          summary = ?,
          narrative = ?,
          status = ?,
          updated_at = datetime('now')
        WHERE id = ?`,
        [
          event.aircraftType,
          event.operator,
          event.category || 'unknown',
          event.airportIcao,
          event.airportIata,
          event.lat,
          event.lon,
          event.country,
          event.region,
          event.fatalities || 0,
          event.injuries || 0,
          event.summary,
          event.narrative,
          event.status,
          existing.id
        ]
      );
      return String(existing.id);
    } else {
      // Insert new event
      const result = await this.dbRun(
        `INSERT INTO events (
          date_z, registration, aircraft_type, operator, category,
          airport_icao, airport_iata, latitude, longitude, country, region,
          fatalities, injuries, summary, narrative, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.dateZ,
          event.registration,
          event.aircraftType,
          event.operator,
          event.category || 'unknown',
          event.airportIcao,
          event.airportIata,
          event.lat,
          event.lon,
          event.country,
          event.region,
          event.fatalities || 0,
          event.injuries || 0,
          event.summary,
          event.narrative,
          event.status
        ]
      );
      return String(result.lastID);
    }
  }

  /**
   * Find existing event ID by unique key (date_z, registration)
   */
  async findEventId(dateZ: string, registration: string): Promise<string | null> {
    const existing = await this.dbGet(
      'SELECT id FROM events WHERE date_z = ? AND registration = ?',
      [dateZ, registration]
    );
    return existing ? String(existing.id) : null;
  }

  /**
   * Add a source entry for an event
   */
  async addSource(eventId: string, source: SourceAttribution): Promise<string> {
    const existing = await this.dbGet(
      'SELECT id FROM sources WHERE event_id = ? AND source_name = ? AND url = ?',
      [Number(eventId), source.sourceName, source.url]
    );
    if (existing) {
      await this.dbRun('UPDATE sources SET fetched_at = ?, title = COALESCE(?, title) WHERE id = ?',
        [source.fetchedAt, source.title ?? null, existing.id]);
      return String(existing.id);
    }
    const result = await this.dbRun(
      `INSERT INTO sources (event_id, source_name, title, url, fetched_at, checksum, raw_fragment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(eventId),
        source.sourceName,
        source.title ?? null,
        source.url,
        source.fetchedAt,
        source.checksum,
        null // raw_fragment optional
      ]
    );
    return String(result.lastID);
  }

  async addCause(eventId: string, cause: CauseAttribution): Promise<void> {
    await this.dbRun(`INSERT INTO causes (event_id, label, source_name, url, basis)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(event_id, label, url) DO UPDATE SET
        source_name = CASE WHEN excluded.basis = 'official' THEN excluded.source_name ELSE causes.source_name END,
        basis = CASE WHEN excluded.basis = 'official' THEN 'official'
          WHEN causes.basis = 'reported' AND excluded.basis = 'occurrence' THEN 'occurrence'
          ELSE causes.basis END`, [Number(eventId), cause.label, cause.sourceName, cause.url, cause.basis]);
  }

  async recordIngestStart(): Promise<void> {
    await this.dbRun(`INSERT INTO ingest_status (id, last_attempt_at, last_error)
      VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL)
      ON CONFLICT(id) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, last_error = NULL`);
  }

  async recordIngestResult(result: { inserted: number; updated: number }, error?: string): Promise<void> {
    if (error) {
      await this.dbRun('UPDATE ingest_status SET last_error = ? WHERE id = 1', [error.slice(0, 500)]);
    } else {
      await this.dbRun(`UPDATE ingest_status SET last_success_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        last_error = NULL, inserted = ?, updated = ? WHERE id = 1`, [result.inserted, result.updated]);
    }
  }

  async getIngestStatus(): Promise<any> {
    return await this.dbGet('SELECT last_attempt_at AS lastAttemptAt, last_success_at AS lastSuccessAt, last_error AS lastError, inserted, updated FROM ingest_status WHERE id = 1') ?? {
      lastAttemptAt: null, lastSuccessAt: null, lastError: null, inserted: null, updated: null,
    };
  }

  private async sourcesFor(rows: DbEvent[]): Promise<Map<number, SourceAttribution[]>> {
    const result = new Map<number, SourceAttribution[]>();
    for (let start = 0; start < rows.length; start += 500) {
      const ids = rows.slice(start, start + 500).map(row => row.id);
      if (!ids.length) continue;
      const found: DbSource[] = await this.dbAll(`SELECT * FROM sources WHERE event_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ids);
      for (const row of found) {
        const values = result.get(row.event_id) ?? [];
        values.push(this.dbSourceToAttribution(row));
        result.set(row.event_id, values);
      }
    }
    return result;
  }

  private async causesFor(rows: DbEvent[]): Promise<Map<number, CauseAttribution[]>> {
    const result = new Map<number, CauseAttribution[]>();
    if (!rows.length) return result;
    for (let start = 0; start < rows.length; start += 500) {
      const ids = rows.slice(start, start + 500).map(row => row.id);
      const found = await this.dbAll(`SELECT event_id, label, source_name, url, basis FROM causes
        WHERE event_id IN (${ids.map(() => '?').join(',')})
        ORDER BY CASE basis WHEN 'official' THEN 0 WHEN 'occurrence' THEN 1 ELSE 2 END, label`, ids);
      for (const row of found) {
        const values = result.get(row.event_id) ?? [];
        values.push({ label: row.label, sourceName: row.source_name, url: row.url, basis: row.basis });
        result.set(row.event_id, values);
      }
    }
    return result;
  }

  async listEventsNeedingMediaSearch(limit: number): Promise<EventRecord[]> {
    const rows: DbEvent[] = await this.dbAll(`
      SELECT events.* FROM events LEFT JOIN media_checks ON media_checks.event_id = events.id
      WHERE events.date_z >= datetime('now', '-400 days')
        AND (media_checks.checked_at IS NULL OR media_checks.checked_at < datetime('now', '-7 days'))
      ORDER BY CASE WHEN media_checks.checked_at IS NULL THEN 0 ELSE 1 END,
        events.created_at DESC, events.date_z DESC
      LIMIT ?`, [limit]);
    return rows.map(row => this.dbEventToRecord(row));
  }

  async markMediaSearched(eventId: string): Promise<void> {
    await this.dbRun(`INSERT INTO media_checks (event_id, checked_at) VALUES (?, datetime('now'))
      ON CONFLICT(event_id) DO UPDATE SET checked_at = excluded.checked_at`, [Number(eventId)]);
  }

  /**
   * List events with pagination and filters
   */
  async listEvents(params: ListEventsParams): Promise<{ events: EventRecord[]; total: number }> {
    const conditions: string[] = [];
    const sqlParams: any[] = [];

    // Date range filter
    if (params.from) {
      conditions.push('date_z >= ?');
      sqlParams.push(params.from);
    }
    if (params.to) {
      conditions.push('date_z <= ?');
      sqlParams.push(params.to);
    }

    // Category filter
    if (params.category && params.category !== 'all') {
      conditions.push('category = ?');
      sqlParams.push(params.category);
    }

    // Airport filter
    if (params.airport) {
      conditions.push('(airport_icao = ? OR airport_iata = ?)');
      sqlParams.push(params.airport, params.airport);
    }

    // Country/region filter
    if (params.country) {
      conditions.push('country = ?');
      sqlParams.push(params.country);
    }
    if (params.region) {
      conditions.push('region = ?');
      sqlParams.push(params.region);
    }

    // Text search (summary, operator, registration)
    if (params.search) {
      conditions.push('(summary LIKE ? OR operator LIKE ? OR registration LIKE ?)');
      const searchPattern = `%${params.search}%`;
      sqlParams.push(searchPattern, searchPattern, searchPattern);
    }
    if (params.cause) {
      conditions.push('EXISTS (SELECT 1 FROM causes WHERE causes.event_id = events.id AND causes.label = ?)');
      sqlParams.push(params.cause);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    // Get total count
    const total = await this.countEvents(params);

    const sql = `
      SELECT * FROM events
      ${whereClause}
      ORDER BY date_z DESC
      LIMIT ? OFFSET ?
    `;

    sqlParams.push(limit, offset);

    const rows: DbEvent[] = await this.dbAll(sql, sqlParams);
    
    const [causes, sources] = await Promise.all([this.causesFor(rows), this.sourcesFor(rows)]);
    const events = rows.map(row => this.dbEventToRecord(row, sources.get(row.id) ?? [], causes.get(row.id) ?? []));
    
    return { events, total };
  }

  /**
   * List events for export (no pagination)
   */
  async listEventsForExport(params: ListEventsParams): Promise<EventRecord[]> {
    const conditions: string[] = [];
    const sqlParams: any[] = [];

    if (params.from) {
      conditions.push('date_z >= ?');
      sqlParams.push(params.from);
    }
    if (params.to) {
      conditions.push('date_z <= ?');
      sqlParams.push(params.to);
    }
    if (params.category && params.category !== 'all') {
      conditions.push('category = ?');
      sqlParams.push(params.category);
    }
    if (params.airport) {
      conditions.push('(airport_icao = ? OR airport_iata = ?)');
      sqlParams.push(params.airport, params.airport);
    }
    if (params.country) {
      conditions.push('country = ?');
      sqlParams.push(params.country);
    }
    if (params.region) {
      conditions.push('region = ?');
      sqlParams.push(params.region);
    }
    if (params.search) {
      conditions.push('(summary LIKE ? OR operator LIKE ? OR registration LIKE ?)');
      const searchPattern = `%${params.search}%`;
      sqlParams.push(searchPattern, searchPattern, searchPattern);
    }
    if (params.cause) {
      conditions.push('EXISTS (SELECT 1 FROM causes WHERE causes.event_id = events.id AND causes.label = ?)');
      sqlParams.push(params.cause);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT * FROM events
      ${whereClause}
      ORDER BY date_z DESC
    `;

    const rows: DbEvent[] = await this.dbAll(sql, sqlParams);
    const causes = await this.causesFor(rows);
    return rows.map(row => this.dbEventToRecord(row, [], causes.get(row.id) ?? []));
  }

  /**
   * Get event detail with sources
   */
  async getEventWithSources(id: string): Promise<EventRecord | null> {
    const event: DbEvent = await this.dbGet('SELECT * FROM events WHERE id = ?', [Number(id)]);
    if (!event) return null;

    const dbSources: DbSource[] = await this.dbAll('SELECT * FROM sources WHERE event_id = ?', [Number(id)]);
    const sources = dbSources.map(s => this.dbSourceToAttribution(s));

    const causes = await this.causesFor([event]);
    return this.dbEventToRecord(event, sources, causes.get(event.id) ?? []);
  }

  /**
   * Get event detail (alias for getEventWithSources for GraphQL compatibility)
   */
  async getEventDetail(id: number): Promise<EventRecord | null> {
    return this.getEventWithSources(String(id));
  }

  /**
   * Count total events matching filter
   */
  async countEvents(params: ListEventsParams): Promise<number> {
    const conditions: string[] = [];
    const sqlParams: any[] = [];

    if (params.from) {
      conditions.push('date_z >= ?');
      sqlParams.push(params.from);
    }
    if (params.to) {
      conditions.push('date_z <= ?');
      sqlParams.push(params.to);
    }
    if (params.category && params.category !== 'all') {
      conditions.push('category = ?');
      sqlParams.push(params.category);
    }
    if (params.airport) {
      conditions.push('(airport_icao = ? OR airport_iata = ?)');
      sqlParams.push(params.airport, params.airport);
    }
    if (params.country) {
      conditions.push('country = ?');
      sqlParams.push(params.country);
    }
    if (params.region) {
      conditions.push('region = ?');
      sqlParams.push(params.region);
    }
    if (params.search) {
      conditions.push('(summary LIKE ? OR operator LIKE ? OR registration LIKE ?)');
      const searchPattern = `%${params.search}%`;
      sqlParams.push(searchPattern, searchPattern, searchPattern);
    }
    if (params.cause) {
      conditions.push('EXISTS (SELECT 1 FROM causes WHERE causes.event_id = events.id AND causes.label = ?)');
      sqlParams.push(params.cause);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT COUNT(*) as count FROM events ${whereClause}`;

    const result = await this.dbGet(sql, sqlParams);
    return result.count;
  }

  /**
   * Get statistics aggregated by specified field
   */
  async getStatistics(params: any): Promise<any[]> {
    const conditions: string[] = [];
    const sqlParams: any[] = [];

    // Apply filters
    if (params.from) {
      conditions.push('date_z >= ?');
      sqlParams.push(params.from);
    }
    if (params.to) {
      conditions.push('date_z <= ?');
      sqlParams.push(params.to);
    }
    if (params.category && params.category !== 'all') {
      conditions.push('category = ?');
      sqlParams.push(params.category);
    }
    if (params.country) {
      conditions.push('country = ?');
      sqlParams.push(params.country);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Group by specified field
    const groupBy = params.groupBy || 'category';
    let sql: string;

    switch (groupBy) {
      case 'category':
        sql = `
          SELECT 
            category,
            COUNT(*) as count,
            SUM(fatalities) as total_fatalities,
            SUM(injuries) as total_injuries
          FROM events
          ${whereClause}
          GROUP BY category
          ORDER BY count DESC
        `;
        break;

      case 'country':
        sql = `
          SELECT 
            country,
            COUNT(*) as count,
            SUM(fatalities) as total_fatalities,
            SUM(injuries) as total_injuries
          FROM events
          ${whereClause}
          GROUP BY country
          ORDER BY count DESC
          LIMIT 50
        `;
        break;

      case 'date':
        sql = `
          SELECT 
            substr(date_z, 1, 7) as period,
            COUNT(*) as count,
            SUM(fatalities) as total_fatalities,
            SUM(injuries) as total_injuries
          FROM events
          ${whereClause}
          GROUP BY period
          ORDER BY period DESC
        `;
        break;

      default:
        sql = `
          SELECT 
            category,
            COUNT(*) as count
          FROM events
          ${whereClause}
          GROUP BY category
        `;
    }

    return await this.dbAll(sql, sqlParams);
  }

  /**
   * Get distinct non-null values for a given column (used for filter option lists).
   * Only allows known safe column names to prevent SQL injection.
   */
  async getDistinctValues(column: string): Promise<string[]> {
    const allowed = new Set(['country', 'region', 'category', 'aircraft_type', 'phase_of_flight', 'operator']);
    if (!allowed.has(column)) return [];
    const rows: Array<{ val: string }> = await this.dbAll(
      `SELECT DISTINCT ${column} AS val FROM events WHERE ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column} ASC`,
      []
    );
    return rows.map(r => r.val);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
