/**
 * export.ts — Data export API for aviation accident records.
 *
 * GET /api/export?format=json|csv|geojson&...search params...
 *
 * Supports the same filter parameters as GET /api/events/search plus:
 *   format=json    — JSON array of EventRecord objects
 *   format=csv     — RFC 4180 CSV with header row
 *   format=geojson — GeoJSON FeatureCollection (skips events with no lat/lon)
 *
 * Additional export params:
 *   maxRows=N      — cap export at N records (default 5000, hard max 50000)
 *   filename=name  — suggested filename in Content-Disposition (without extension)
 *
 * Response headers:
 *   Content-Disposition: attachment; filename="aviation-accidents.<ext>"
 *   Content-Type:        application/json | text/csv | application/geo+json
 */

import type { Request, Response } from 'express';
import type { EventRepository, SearchParams } from '../db/repository.js';
import type { EventRecord } from '../types/event.js';

// ── CSV helpers ───────────────────────────────────────────────────────────────

/** CSV columns exported (in order). */
const CSV_COLUMNS: (keyof EventRecord)[] = [
  'id', 'date_z', 'registration', 'aircraft_type', 'operator',
  'location', 'country', 'latitude', 'longitude',
  'phase_of_flight', 'weather_condition',
  'cause', 'summary', 'source', 'source_url',
];

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
  // Quote if contains comma, quote, newline
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function recordsToCsv(records: EventRecord[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows   = records.map(r =>
    CSV_COLUMNS.map(col => {
      const val = r[col];
      // Flatten injuries object into summary count for CSV
      if (col === 'injuries' && val && typeof val === 'object') {
        const inj = val as { fatal?: number; serious?: number; minor?: number; uninjured?: number };
        return csvEscape(`fatal:${inj.fatal ?? 0} serious:${inj.serious ?? 0} minor:${inj.minor ?? 0}`);
      }
      return csvEscape(val);
    }).join(',')
  );
  return [header, ...rows].join('\r\n');
}

// ── GeoJSON helpers ───────────────────────────────────────────────────────────

function recordToGeoJsonFeature(r: EventRecord): object | null {
  if (r.latitude == null || r.longitude == null) return null;
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [r.longitude, r.latitude],
    },
    properties: {
      id:                r.id,
      date:              r.date_z,
      registration:      r.registration ?? null,
      aircraft_type:     r.aircraft_type ?? null,
      operator:          r.operator ?? null,
      location:          r.location ?? null,
      country:           r.country ?? null,
      phase_of_flight:   r.phase_of_flight ?? null,
      weather_condition: r.weather_condition ?? null,
      cause:             r.cause ?? null,
      summary:           r.summary ?? null,
      source:            r.source ?? null,
      source_url:        r.source_url ?? null,
      injuries:          r.injuries ?? null,
      severity: (() => {
        if ((r.injuries?.fatal ?? 0) > 0)   return 'fatal';
        if ((r.injuries?.serious ?? 0) > 0) return 'serious';
        if ((r.injuries?.minor ?? 0) > 0)   return 'minor';
        return 'none';
      })(),
    },
  };
}

function recordsToGeoJson(records: EventRecord[]): object {
  const features = records.map(recordToGeoJsonFeature).filter(Boolean);
  return {
    type: 'FeatureCollection',
    metadata: {
      generated: new Date().toISOString(),
      count:     features.length,
      skipped:   records.length - features.length,
    },
    features,
  };
}

// ── Export handler ────────────────────────────────────────────────────────────

const DEFAULT_MAX_ROWS  = 5_000;
const HARD_MAX_ROWS     = 50_000;

export function createExportHandler(repository: EventRepository) {
  return async (req: Request, res: Response): Promise<void> => {
    const format   = (req.query.format as string ?? 'json').toLowerCase();
    const maxRows  = Math.min(
      parseInt(req.query.maxRows as string || String(DEFAULT_MAX_ROWS), 10) || DEFAULT_MAX_ROWS,
      HARD_MAX_ROWS
    );
    const filename = (req.query.filename as string || 'aviation-accidents').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (!['json', 'csv', 'geojson'].includes(format)) {
      res.status(400).json({ error: 'format must be json, csv, or geojson' });
      return;
    }

    // Build SearchParams from query (same as search endpoint)
    const params: SearchParams = {
      q:            req.query.q           as string | undefined,
      dateFrom:     req.query.dateFrom    as string | undefined,
      dateTo:       req.query.dateTo      as string | undefined,
      country:      req.query.country     as string | undefined,
      aircraftType: req.query.aircraftType as string | undefined,
      severity:     req.query.severity    as SearchParams['severity'],
      source:       req.query.source      as string | undefined,
      phase:        req.query.phase       as string | undefined,
      sortBy:       req.query.sortBy      as string | undefined,
      sortDir:      req.query.sortDir     as 'asc' | 'desc' | undefined,
      limit:        maxRows,
      offset:       0,
    };

    // Bounding box
    if (req.query.minLat && req.query.maxLat && req.query.minLon && req.query.maxLon) {
      params.bbox = {
        minLat: parseFloat(req.query.minLat as string),
        maxLat: parseFloat(req.query.maxLat as string),
        minLon: parseFloat(req.query.minLon as string),
        maxLon: parseFloat(req.query.maxLon as string),
      };
    }

    try {
      const { events, total } = await repository.searchEvents(params);

      switch (format) {
        case 'csv': {
          const csv = recordsToCsv(events);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          res.setHeader('X-Export-Count',  String(events.length));
          res.setHeader('X-Export-Total',  String(total));
          res.end(csv);
          break;
        }
        case 'geojson': {
          const gj = recordsToGeoJson(events);
          res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.geojson"`);
          res.setHeader('X-Export-Count',  String(events.length));
          res.setHeader('X-Export-Total',  String(total));
          res.json(gj);
          break;
        }
        default: { // json
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
          res.setHeader('X-Export-Count',  String(events.length));
          res.setHeader('X-Export-Total',  String(total));
          res.json({
            meta:   { count: events.length, total, generated: new Date().toISOString() },
            events,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Export failed', detail: msg });
    }
  };
}
