/**
 * Loader for the airport dataset bundled with this package.
 *
 * Kept out of `airports/index.ts` on purpose: it touches `fs`/`path`, so
 * importing it from the browser-safe core would break bundlers. Node consumers
 * import it explicitly via `@aviation/shared-sdk/aviation/airports/bundled`.
 *
 * @module @aviation/shared-sdk/aviation/airports/bundled
 */

import * as fs from 'fs';
import * as path from 'path';

import { Airport } from './types';
import { loadAirportData, getAirportDatabase } from './service';

/** Default location of the packaged dataset, relative to the built output. */
export const BUNDLED_AIRPORTS_PATH = path.join(__dirname, '../../../data/airports_cache.json');

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

/**
 * Read and normalize the packaged airport dataset.
 *
 * @param dataPath - Override the dataset location
 * @returns Normalized airport records
 */
export function readBundledAirports(dataPath: string = BUNDLED_AIRPORTS_PATH): Airport[] {
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as Array<Record<string, unknown>>;
  const airports: Airport[] = [];

  for (const entry of raw) {
    const latitude = toNumber(entry.latitude ?? entry.lat);
    const longitude = toNumber(entry.longitude ?? entry.lon);
    const icao = String(entry.icao ?? entry.icaoCode ?? '').toUpperCase();
    if (latitude === null || longitude === null || !icao) {
      continue;
    }

    airports.push({
      icao,
      iata: String(entry.iata ?? entry.iataCode ?? '').toUpperCase() || undefined,
      name: String(entry.name ?? ''),
      city: String(entry.city ?? '') || undefined,
      country: String(entry.country ?? ''),
      latitude,
      longitude,
      elevation: toNumber(entry.elevation) ?? undefined,
      type: String(entry.type ?? '') || undefined,
    });
  }

  return airports;
}

/**
 * Load the packaged dataset into the airport service.
 *
 * Idempotent: does nothing if a database is already loaded, unless `force` is set.
 *
 * @returns The number of airports now loaded
 */
export function loadBundledAirports(
  options: { dataPath?: string; force?: boolean; warmCache?: boolean } = {}
): number {
  if (!options.force && getAirportDatabase().length > 0) {
    return getAirportDatabase().length;
  }

  const airports = readBundledAirports(options.dataPath ?? BUNDLED_AIRPORTS_PATH);
  loadAirportData(airports, options.warmCache ?? true);
  return airports.length;
}
