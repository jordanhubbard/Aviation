/**
 * METAR fetching and parsing for aviation weather
 * 
 * Fetches METARs from AviationWeather.gov and parses key elements:
 * - Wind (direction, speed, gusts)
 * - Visibility
 * - Temperature/dewpoint
 * - Ceiling (from cloud layers)
 */

import { weatherCache } from './cache';
import { ParsedMetar, WeatherError } from './types';

// Regular expressions for METAR parsing
const WIND_RE = /\b(?<dir>\d{3}|VRB)(?<speed>\d{2,3})(G(?<gust>\d{2,3}))?KT\b/;
const TEMP_RE = /\b(?<t>M?\d{2})\/(?<d>M?\d{2})\b/;
const VIS_RE = /\b(?<vis>P?\d+(?:\s\d\/\d)?|\d+\/\d)SM\b/;
const CEIL_RE = /\b(?<kind>BKN|OVC|VV)(?<hundreds>\d{3})\b/g;

/**
 * Check if METAR fetching is disabled (for testing)
 */
function isMetarFetchDisabled(): boolean {
  return process.env.DISABLE_METAR_FETCH === '1';
}

/**
 * Parse signed integer (handles M prefix for negative)
 */
function parseSignedInt(token: string): number {
  if (token.startsWith('M')) {
    return -parseInt(token.substring(1), 10);
  }
  return parseInt(token, 10);
}

/**
 * Parse visibility in statute miles (handles fractions and "P" prefix)
 */
function parseVisibilitySm(token: string): number | null {
  token = token.replace('SM', '').trim();

  // P prefix means "greater than"
  if (token.startsWith('P')) {
    try {
      return parseFloat(token.substring(1));
    } catch {
      return null;
    }
  }

  // Whole number with fraction (e.g., "1 1/2")
  if (token.includes(' ')) {
    const [whole, frac] = token.split(' ');
    try {
      const [num, den] = frac.split('/').map(s => parseInt(s, 10));
      return parseInt(whole, 10) + num / den;
    } catch {
      return null;
    }
  }

  // Just a fraction (e.g., "1/2")
  if (token.includes('/')) {
    try {
      const [num, den] = token.split('/').map(s => parseInt(s, 10));
      return num / den;
    } catch {
      return null;
    }
  }

  // Whole number
  try {
    return parseFloat(token);
  } catch {
    return null;
  }
}

/**
 * Parse a METAR string and extract key weather elements
 * 
 * @param raw - Raw METAR string
 * @returns Parsed METAR data
 */
export function parseMetar(raw: string): ParsedMetar {
  const result: ParsedMetar = {};

  // Parse wind
  const windMatch = WIND_RE.exec(raw);
  if (windMatch) {
    const dir = windMatch.groups?.dir;
    result.wind_direction = dir === 'VRB' ? undefined : parseInt(dir || '0', 10);
    result.wind_speed_kt = parseInt(windMatch.groups?.speed || '0', 10);
  }

  // Parse visibility
  const visMatch = VIS_RE.exec(raw);
  if (visMatch) {
    const vis = parseVisibilitySm(visMatch.groups?.vis || '');
    if (vis !== null) {
      result.visibility_sm = vis;
    }
  }

  // Parse temperature
  const tempMatch = TEMP_RE.exec(raw);
  if (tempMatch) {
    try {
      const tempC = parseSignedInt(tempMatch.groups?.t || '');
      result.temperature_f = Math.round((tempC * 9) / 5 + 32);
    } catch {
      // Ignore parse errors
    }
  }

  // Parse ceiling (lowest BKN, OVC, or VV layer)
  const ceilings: number[] = [];
  let match;
  while ((match = CEIL_RE.exec(raw)) !== null) {
    try {
      const hundreds = parseInt(match.groups?.hundreds || '0', 10);
      ceilings.push(hundreds * 100);
    } catch {
      // Ignore parse errors
    }
  }
  if (ceilings.length > 0) {
    result.ceiling_ft = Math.min(...ceilings);
  }

  return result;
}

/**
 * Fetch raw METAR for a single station
 * 
 * @param station - ICAO station identifier
 * @returns Raw METAR string or null if unavailable
 * @throws WeatherError if API call fails
 */
export async function fetchMetarRaw(station: string): Promise<string | null> {
  if (isMetarFetchDisabled()) {
    return null;
  }

  const stationUpper = station.toUpperCase();
  const cacheKey = `metar:${stationUpper}`;

  return weatherCache.getOrSet(
    cacheKey,
    300, // 5 minute TTL
    async () => {
      const params = new URLSearchParams({
        ids: stationUpper,
        format: 'raw',
      });

      const url = `https://aviationweather.gov/api/data/metar?${params}`;

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'aviation-shared-sdk',
          },
        });

        // 204 means no content available
        if (response.status === 204) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        if (!text.trim()) {
          return null;
        }

        // API may return multiple lines; we only requested a single station
        const lines = text.trim().split('\n');
        return lines[0].trim() || null;
      } catch (error) {
        throw new WeatherError(
          `Failed to fetch METAR for ${stationUpper}: ${error}`,
          'AviationWeather.gov',
          error instanceof Error ? error : undefined
        );
      }
    },
    true // Allow stale data on error
  );
}

/**
 * Fetch raw METARs for multiple stations
 * 
 * @param stations - Array of ICAO station identifiers
 * @returns Map of station to raw METAR (null if unavailable)
 */
export async function fetchMetarRaws(
  stations: string[]
): Promise<Map<string, string | null>> {
  if (isMetarFetchDisabled()) {
    return new Map(stations.map(s => [s.toUpperCase(), null]));
  }

  // Normalize and deduplicate stations
  const stationsSet = new Set<string>();
  const stationsOrder: string[] = [];
  for (const s of stations) {
    const su = s.trim().toUpperCase();
    if (su && !stationsSet.has(su)) {
      stationsSet.add(su);
      stationsOrder.push(su);
    }
  }

  const result = new Map<string, string | null>();
  const missing: string[] = [];
  const staleData = new Map<string, string | null>();

  // Check cache first
  for (const s of stationsOrder) {
    const cacheKey = `metar:${s}`;
    const cached = weatherCache.get<string>(cacheKey);

    if (cached !== undefined) {
      result.set(s, cached);
    } else {
      missing.push(s);
      const stale = weatherCache.getStale<string>(cacheKey);
      staleData.set(cacheKey, stale ?? null);
    }
  }

  // If all stations were cached, return early
  if (missing.length === 0) {
    return result;
  }

  // Fetch missing stations
  try {
    const params = new URLSearchParams({
      ids: missing.join(','),
      format: 'raw',
    });

    const url = `https://aviationweather.gov/api/data/metar?${params}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'aviation-shared-sdk',
      },
    });

    // 204 means no content available
    if (response.status === 204) {
      for (const s of missing) {
        result.set(s, null);
      }
      return result;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    const lines = text.trim().split('\n').filter(ln => ln.trim());

    // Parse response - each line should start with station code
    const found = new Map<string, string>();
    for (const line of lines) {
      const code = line.split(/\s+/)[0]?.toUpperCase();
      if (code && result.has(code) !== undefined) {
        found.set(code, line);
      }
    }

    // Update results and cache
    for (const s of missing) {
      const raw = found.get(s) || null;
      result.set(s, raw);
      if (raw) {
        weatherCache.set(`metar:${s}`, raw, 300);
      }
    }

    return result;
  } catch (error) {
    // Best effort: fall back to stale values if present
    for (const s of missing) {
      const cacheKey = `metar:${s}`;
      const stale = staleData.get(cacheKey);
      result.set(s, stale !== undefined ? stale : null);
    }
    return result;
  }
}

/**
 * Fetch and parse METAR for a single station
 * 
 * @param station - ICAO station identifier
 * @returns Parsed METAR data or null if unavailable
 */
export async function fetchMetar(station: string): Promise<ParsedMetar | null> {
  const raw = await fetchMetarRaw(station);
  if (!raw) {
    return null;
  }
  return parseMetar(raw);
}

/**
 * Fetch and parse METARs for multiple stations
 * 
 * @param stations - Array of ICAO station identifiers
 * @returns Map of station to parsed METAR (null if unavailable)
 */
export async function fetchMetars(
  stations: string[]
): Promise<Map<string, ParsedMetar | null>> {
  const raws = await fetchMetarRaws(stations);
  const result = new Map<string, ParsedMetar | null>();

  for (const [station, raw] of raws) {
    result.set(station, raw ? parseMetar(raw) : null);
  }

  return result;
}
