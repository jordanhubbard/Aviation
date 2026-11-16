/** Fixed AWC products; the injected JSON transport owns HTTP/time/byte bounds. */
import type { JSONWeatherTransport } from './types.js';
export const AWC_ORIGIN = 'https://aviationweather.gov';
export const AWC_DATA_URL = AWC_ORIGIN + '/api/data/';
export type AWCJSONTransport = JSONWeatherTransport;

export class AWCJSONError extends Error {
  constructor(readonly kind: 'request' | 'provider' | 'response') {
    super(kind === 'request' ? 'Invalid AWC JSON request' : 'AWC JSON reports unavailable');
    this.name = 'AWCJSONError';
  }
}

function station(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8192) throw new AWCJSONError('request');
  const normalized = value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(normalized)) throw new AWCJSONError('request');
  return normalized.toUpperCase();
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

/** No retry, cache, stale fallback, provenance timestamp or report reduction. */
export async function fetchAWCJSONReports(product: string, params: unknown, transport: AWCJSONTransport): Promise<{
  url: string; reports: Record<string, unknown>[];
}> {
  if (!['metar', 'taf', 'pirep', 'gairmet', 'airsigmet', 'cwa'].includes(product)
      || !record(params) || typeof transport !== 'function') throw new AWCJSONError('request');
  const keys = Object.keys(params).sort();
  let query: Record<string, string | number>;
  if (product === 'metar' || product === 'taf') {
    if (keys.join(',') !== 'ids' || typeof params.ids !== 'string' || params.ids.length > 8192) throw new AWCJSONError('request');
    const ids = params.ids.split(',');
    if (ids.length > 40) throw new AWCJSONError('request');
    query = { ids: ids.map(station).join(',') };
  } else if (product === 'pirep') {
    if (keys.join(',') !== 'age,distance,id' || typeof params.distance !== 'number'
        || !Number.isFinite(params.distance) || params.distance < 1 || params.distance > 500
        || typeof params.age !== 'number' || !Number.isInteger(params.age) || params.age < 1 || params.age > 24) throw new AWCJSONError('request');
    query = { id: station(params.id), distance: params.distance, age: params.age };
  } else {
    if (keys.length !== 0) throw new AWCJSONError('request');
    query = {};
  }
  const url = AWC_DATA_URL + product;
  let reports: unknown;
  try { reports = await transport(url, { ...query, format: 'json' }); }
  catch { throw new AWCJSONError('provider'); }
  if (!Array.isArray(reports)) throw new AWCJSONError('response');
  for (const report of reports) if (!record(report)) throw new AWCJSONError('response');
  return { url, reports };
}
