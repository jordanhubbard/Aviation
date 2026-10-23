/**
 * Relevance-ranked airport search with optional geographic filtering.
 *
 * Unlike {@link searchAirports}, which is an unranked substring filter, this
 * scores candidates (exact code > prefix > substring > fuzzy) and can combine a
 * text query with a proximity filter in a single pass.
 *
 * @module @aviation/shared-sdk/aviation/airports
 */

import { Airport } from './types.js';
import { getAirportDatabase, candidateCodes } from './service.js';

/** Earth radius in nautical miles. */
const EARTH_RADIUS_NM = 3440.065;

/** Fuzzy matches scoring below this ratio are discarded. */
const MIN_FUZZY_RATIO = 0.6;

export interface AirportSearchAdvancedOptions {
  /** Free-text query matched against codes, name, city and country */
  query?: string;
  /** Latitude of the search origin, in decimal degrees */
  lat?: number;
  /** Longitude of the search origin, in decimal degrees */
  lon?: number;
  /** Optional radius filter in nautical miles; requires lat/lon */
  radiusNm?: number;
  /** Maximum number of results (default 20) */
  limit?: number;
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return EARTH_RADIUS_NM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Ordered-character overlap ratio, a lightweight stand-in for a full
 * sequence-alignment score.
 */
function similarityRatio(s1: string, s2: string): number {
  if (!s1.length || !s2.length) return 0;

  let matches = 0;
  let i = 0;
  let j = 0;
  while (i < s1.length && j < s2.length) {
    if (s1[i] === s2[j]) {
      matches++;
      i++;
    }
    j++;
  }
  return (2.0 * matches) / (s1.length + s2.length);
}

function scoreAirport(airport: Airport, query: string): number | null {
  const icao = (airport.icao || '').toUpperCase();
  const iata = (airport.iata || '').toUpperCase();
  const codes = [icao, iata, ...Array.from(candidateCodes(icao))].filter(Boolean);
  const codeHay = codes.join(' ').toLowerCase();
  const textHay =
    `${codeHay} ${airport.name || ''} ${airport.city || ''} ${airport.country || ''}`.toLowerCase();

  if (codes.some((c) => c.toLowerCase() === query)) return 1.0;
  if (icao.toLowerCase().startsWith(query)) return 0.95;
  if (iata.toLowerCase().startsWith(query)) return 0.9;
  if (codeHay.includes(query)) return 0.85;
  if (textHay.includes(query)) return 0.65;

  const ratio = Math.max(
    similarityRatio(query, icao.toLowerCase()),
    similarityRatio(query, iata.toLowerCase()),
    similarityRatio(query, (airport.name || '').toLowerCase())
  );
  if (ratio < MIN_FUZZY_RATIO) return null;

  return 0.5 + (ratio - MIN_FUZZY_RATIO) * 0.5;
}

/**
 * Search airports by text relevance, proximity, or both.
 *
 * Returns an empty array unless at least a query or a lat/lon pair is given.
 * Results carry `distance_nm` whenever an origin was supplied.
 *
 * @example
 * ```typescript
 * // Text search, relevance-ranked
 * searchAirportsAdvanced({ query: 'KSFO' });
 *
 * // Airports within 50 NM, nearest first
 * searchAirportsAdvanced({ lat: 37.62, lon: -122.37, radiusNm: 50 });
 *
 * // Combined: best text matches near a point
 * searchAirportsAdvanced({ query: 'international', lat: 37.62, lon: -122.37, radiusNm: 100 });
 * ```
 */
export function searchAirportsAdvanced(options: AirportSearchAdvancedOptions): Airport[] {
  const query = (options.query || '').trim().toLowerCase();
  const limit = options.limit ?? 20;
  const hasGeo = typeof options.lat === 'number' && typeof options.lon === 'number';

  if (!query && !hasGeo) {
    return [];
  }

  const candidates: Array<{ score: number; distance: number; airport: Airport }> = [];
  const seen = new Set<string>();

  for (const airport of getAirportDatabase()) {
    if (typeof airport.latitude !== 'number' || typeof airport.longitude !== 'number') {
      continue;
    }

    let distance = Infinity;
    if (hasGeo) {
      distance = haversineNm(options.lat!, options.lon!, airport.latitude, airport.longitude);
      if (options.radiusNm !== undefined && distance > options.radiusNm) {
        continue;
      }
    }

    let score = 0;
    if (query) {
      const scored = scoreAirport(airport, query);
      if (scored === null) continue;
      score = scored;
    }

    const key =
      airport.icao || airport.iata || `${airport.latitude},${airport.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const result: Airport = { ...airport };
    if (hasGeo) {
      result.distance_nm = Math.round(distance * 100) / 100;
    }

    candidates.push({ score, distance, airport: result });
  }

  if (hasGeo && !query) {
    candidates.sort((a, b) => a.distance - b.distance);
  } else {
    candidates.sort((a, b) => b.score - a.score || a.distance - b.distance);
  }

  return candidates.slice(0, limit).map((c) => c.airport);
}
