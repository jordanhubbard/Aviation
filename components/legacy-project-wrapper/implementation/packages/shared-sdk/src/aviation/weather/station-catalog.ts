/** Provider semantics only. Trusted transport owns bounded gzip/JSON decoding. */
import { AWC_ORIGIN } from './awc.js';
import type { JSONWeatherTransport } from './types.js';

export const AWC_STATION_CATALOG_URL = AWC_ORIGIN + '/data/cache/stations.cache.json.gz';
export class AWCStationCatalogError extends Error {
  constructor(readonly kind: 'request' | 'provider' | 'response') {
    super(kind === 'request' ? 'Invalid AWC station catalog request' : 'AWC station catalog unavailable');
    this.name = 'AWCStationCatalogError';
  }
}
export interface AWCStationCatalog {
  stations: Record<string, unknown>[];
  total_catalog_records: number;
  excluded_unlocated_count: number;
  unlocated_taf_station_ids: string[];
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(value);
}
export function interpretAWCStationCatalog(payload: unknown): AWCStationCatalog {
  const fail = (): never => { throw new AWCStationCatalogError('response'); };
  if (!Array.isArray(payload) || payload.length === 0 || payload.length > 50000) return fail();
  const stations: Record<string, unknown>[] = [], unlocated_taf_station_ids: string[] = [];
  let excluded_unlocated_count = 0;
  for (const row of payload) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)
        || Object.getPrototypeOf(row) !== Object.prototype || !identifier(row.id)
        || (row.icaoId !== undefined && row.icaoId !== null && row.icaoId !== '' && !identifier(row.icaoId))
        || !Array.isArray(row.siteType)) return fail();
    for (const product of row.siteType) if (typeof product !== 'string') return fail();
    const lat: unknown = row.lat, lon: unknown = row.lon;
    if (typeof lat !== 'number' || !Number.isFinite(lat) || typeof lon !== 'number' || !Number.isFinite(lon)) return fail();
    if (lat > -100 && lat <= -99 && lon > -100 && lon <= -99) {
      excluded_unlocated_count++;
      if (row.siteType.includes('TAF') && row.icaoId) unlocated_taf_station_ids.push(row.icaoId);
    } else {
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return fail();
      stations.push(row);
    }
  }
  return { stations, total_catalog_records: payload.length, excluded_unlocated_count, unlocated_taf_station_ids };
}
export async function fetchAWCStationCatalog(transport: JSONWeatherTransport): Promise<AWCStationCatalog & { url: string }> {
  if (typeof transport !== 'function') throw new AWCStationCatalogError('request');
  let payload: unknown;
  try { payload = await transport(AWC_STATION_CATALOG_URL, {}); }
  catch { throw new AWCStationCatalogError('provider'); }
  return { url: AWC_STATION_CATALOG_URL, ...interpretAWCStationCatalog(payload) };
}
