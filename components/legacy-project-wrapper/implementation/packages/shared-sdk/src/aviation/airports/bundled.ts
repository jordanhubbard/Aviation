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

import { Airport } from './types.js';
import { loadAirportData, getAirportDatabase } from './service.js';

/** Dataset location relative to the package root. */
const DATA_RELATIVE_PATH = path.join('data', 'airports_cache.json');

/** Overrides dataset discovery entirely. */
const DATA_PATH_ENV = 'AVIATION_AIRPORTS_DATA';

/**
 * Locate the packaged dataset.
 *
 * This package is built in both CommonJS and ESM form, so neither `__dirname`
 * nor `import.meta.url` is available in both outputs. Search upward from the
 * working directory instead, covering the monorepo checkout and an installed
 * dependency.
 *
 * @throws if the dataset cannot be found
 */
export function resolveBundledAirportsPath(): string {
  const override = process.env[DATA_PATH_ENV];
  if (override) {
    return override;
  }

  let dir = process.cwd();
  for (;;) {
    const candidates = [
      path.join(dir, 'packages', 'shared-sdk', DATA_RELATIVE_PATH),
      path.join(dir, 'node_modules', '@aviation', 'shared-sdk', DATA_RELATIVE_PATH),
      path.join(dir, DATA_RELATIVE_PATH),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not locate ${DATA_RELATIVE_PATH} searching upward from ${process.cwd()}. ` +
          `Set ${DATA_PATH_ENV} to point at the dataset.`
      );
    }
    dir = parent;
  }
}

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
export function readBundledAirports(dataPath: string = resolveBundledAirportsPath()): Airport[] {
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

  const airports = readBundledAirports(options.dataPath ?? resolveBundledAirportsPath());
  loadAirportData(airports, options.warmCache ?? true);
  return airports.length;
}
