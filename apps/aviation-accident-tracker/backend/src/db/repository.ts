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
import type { EventRecord, SourceAttribution, ListEventsParams, Category } from '../types.js';

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
  url: string;
  fetched_at: string;
  checksum?: string;
  raw_fragment?: string;
  created_at: string;
}

export class EventRepository {
  private db: sqlite3.Database;
  private dbRun: (sql: string, params?: any[]) => Promise<any>;
  private dbGet: (sql: string, params?: any[]) => Promise<any>;
  private dbAll: (sql: string, params?: any[]) => Promise<any[]>;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
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
    
    await this.dbRun(schema);
  }

  /**
   * Convert DB row to EventRecord type
   */
  private dbEventToRecord(dbEvent: DbEvent, sources: SourceAttribution[] = []): EventRecord {
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
   * Add a source entry for an event
   */
  async addSource(eventId: string, source: SourceAttribution): Promise<string> {
    const result = await this.dbRun(
      `INSERT INTO sources (event_id, source_name, url, fetched_at, checksum, raw_fragment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(eventId),
        source.sourceName,
        source.url,
        source.fetchedAt,
        source.checksum,
        null // raw_fragment optional
      ]
    );
    return String(result.lastID);
  }

  /**
   * List events with pagination and filters
   */
  async listEvents(params: ListEventsParams): Promise<EventRecord[]> {
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const sql = `
      SELECT * FROM events
      ${whereClause}
      ORDER BY date_z DESC
      LIMIT ? OFFSET ?
    `;

    sqlParams.push(limit, offset);

    const rows: DbEvent[] = await this.dbAll(sql, sqlParams);
    
    // For list view, we don't include sources (performance)
    return rows.map(row => this.dbEventToRecord(row, []));
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT * FROM events
      ${whereClause}
      ORDER BY date_z DESC
    `;

    const rows: DbEvent[] = await this.dbAll(sql, sqlParams);
    return rows.map(row => this.dbEventToRecord(row, []));
  }

  /**
   * Get event detail with sources
   */
  async getEventWithSources(id: string): Promise<EventRecord | null> {
    const event: DbEvent = await this.dbGet('SELECT * FROM events WHERE id = ?', [Number(id)]);
    if (!event) return null;

    const dbSources: DbSource[] = await this.dbAll('SELECT * FROM sources WHERE event_id = ?', [Number(id)]);
    const sources = dbSources.map(s => this.dbSourceToAttribution(s));

    return this.dbEventToRecord(event, sources);
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT COUNT(*) as count FROM events ${whereClause}`;

    const result = await this.dbGet(sql, sqlParams);
    return result.count;
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
