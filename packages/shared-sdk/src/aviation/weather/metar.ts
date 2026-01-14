/**
 * METAR Fetching and Parsing
 * 
 * Fetches and parses METAR data from aviationweather.gov.
 * Extracted from flightplanner for shared use.
 */

import { weatherCache } from './cache';

export interface MetarData {
  wind_direction?: number;  // degrees, or null for VRB
  wind_speed_kt?: number;    // knots
  wind_gust_kt?: number;     // knots
  visibility_sm?: number;    // statute miles
  temperature_f?: number;    // Fahrenheit
  ceiling_ft?: number;       // feet AGL
}

/**
 * Fetch raw METAR for a single station
 */
export async function fetchMetarRaw(station: string): Promise<string | null> {
  if (process.env.DISABLE_METAR_FETCH === '1') {
    return null;
  }

  const stationUpper = station.toUpperCase();
  const cacheKey = `metar:${stationUpper}`;

  const fetchFn = async (): Promise<string | null> => {
    const url = new URL('https://aviationweather.gov/api/data/metar');
    url.searchParams.set('ids', stationUpper);
    url.searchParams.set('format', 'raw');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'aviation-shared-sdk' },
      signal: AbortSignal.timeout(20000),
    });

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const trimmed = text.trim();

    if (!trimmed) {
      return null;
    }

    // API may return multiple lines; we only requested a single station
    return trimmed.split('\n')[0].trim() || null;
  };

  return weatherCache.getOrSet(cacheKey, 300, fetchFn, true);
}

/**
 * Fetch raw METARs for multiple stations
 */
export async function fetchMetarRaws(stations: string[]): Promise<Record<string, string | null>> {
  if (process.env.DISABLE_METAR_FETCH === '1') {
    const result: Record<string, string | null> = {};
    for (const s of stations) {
      result[s.toUpperCase()] = null;
    }
    return result;
  }

  // Normalize and deduplicate
  const stationsUpper = Array.from(
    new Set(stations.map(s => s.trim().toUpperCase()).filter(s => s.length > 0))
  );

  const out: Record<string, string | null> = {};
  for (const s of stationsUpper) {
    out[s] = null;
  }

  const missing: string[] = [];
  const stale: Record<string, string | null> = {};

  // Check cache first
  for (const s of stationsUpper) {
    const key = `metar:${s}`;
    const cached = weatherCache.get<string>(key);
    if (cached !== null) {
      out[s] = cached;
      continue;
    }
    missing.push(s);
    stale[key] = weatherCache.getStale<string>(key);
  }

  if (missing.length === 0) {
    return out;
  }

  try {
    const url = new URL('https://aviationweather.gov/api/data/metar');
    url.searchParams.set('ids', missing.join(','));
    url.searchParams.set('format', 'raw');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'aviation-shared-sdk' },
      signal: AbortSignal.timeout(20000),
    });

    if (response.status === 204) {
      return out;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const lines = text.split('\n').map(ln => ln.trim()).filter(ln => ln.length > 0);

    const found: Record<string, string> = {};
    for (const ln of lines) {
      // Expected: "KSFO 201356Z ..." (station code first)
      const code = ln.split(/\s+/, 1)[0].toUpperCase();
      if (code && out.hasOwnProperty(code)) {
        found[code] = ln;
      }
    }

    for (const s of missing) {
      const raw = found[s];
      if (raw) {
        out[s] = raw;
        weatherCache.set(`metar:${s}`, raw, 300);
      }
    }

    return out;
  } catch (error) {
    // Best-effort: fall back to stale values if present
    for (const s of missing) {
      const skey = `metar:${s}`;
      if (stale[skey] !== null && stale[skey] !== undefined) {
        out[s] = stale[skey];
      }
    }
    return out;
  }
}

/**
 * Parse METAR string into structured data
 */
export function parseMetar(raw: string): MetarData {
  const out: MetarData = {};

  // Wind: 09012KT or 00000KT or VRB03KT or 27015G25KT
  const windMatch = raw.match(/\b(?<dir>\d{3}|VRB)(?<speed>\d{2,3})(G(?<gust>\d{2,3}))?KT\b/);
  if (windMatch && windMatch.groups) {
    const dir = windMatch.groups.dir;
    out.wind_direction = dir === 'VRB' ? undefined : parseInt(dir, 10);
    out.wind_speed_kt = parseInt(windMatch.groups.speed, 10);
    if (windMatch.groups.gust) {
      out.wind_gust_kt = parseInt(windMatch.groups.gust, 10);
    }
  }

  // Visibility: 10SM or 1/2SM or 1 1/2SM or P6SM
  const visMatch = raw.match(/\b(?<vis>(P?\d+)(?:\s\d+\/\d+)?|\d+\/\d+)SM\b/);
  if (visMatch && visMatch.groups) {
    const vis = parseVisibilitySM(visMatch.groups.vis);
    if (vis !== null) {
      out.visibility_sm = vis;
    }
  }

  // Temperature/Dewpoint: 15/08 or M02/M08
  const tempMatch = raw.match(/\b(?<t>M?\d{2})\/(?<d>M?\d{2})\b/);
  if (tempMatch && tempMatch.groups) {
    try {
      const tempC = parseSignedInt(tempMatch.groups.t);
      out.temperature_f = Math.round((tempC * 9 / 5) + 32);
    } catch {}
  }

  // Ceiling: BKN015 or OVC025 or VV002
  const ceilings: number[] = [];
  const ceilingRegex = /\b(?:BKN|OVC|VV)(?<hundreds>\d{3})\b/g;
  let ceilingMatch;
  while ((ceilingMatch = ceilingRegex.exec(raw)) !== null) {
    if (ceilingMatch.groups) {
      try {
        ceilings.push(parseInt(ceilingMatch.groups.hundreds, 10) * 100);
      } catch {}
    }
  }
  if (ceilings.length > 0) {
    out.ceiling_ft = Math.min(...ceilings);
  }

  return out;
}

/**
 * Parse signed integer from METAR format (M02 = -2)
 */
function parseSignedInt(token: string): number {
  if (token.startsWith('M')) {
    return -parseInt(token.substring(1), 10);
  }
  return parseInt(token, 10);
}

/**
 * Parse visibility in statute miles
 * Examples: "10", "1/2", "1 1/2", "P6"
 */
function parseVisibilitySM(token: string): number | null {
  token = token.trim().replace(/SM$/, '');

  // Greater than (P6SM = greater than 6)
  if (token.startsWith('P')) {
    try {
      return parseFloat(token.substring(1));
    } catch {
      return null;
    }
  }

  // Mixed number (1 1/2)
  if (token.includes(' ')) {
    const [whole, frac] = token.split(' ', 2);
    try {
      const wholeNum = parseInt(whole, 10);
      const fracNum = parseFraction(frac);
      return fracNum !== null ? wholeNum + fracNum : null;
    } catch {
      return null;
    }
  }

  // Fraction (1/2)
  if (token.includes('/')) {
    return parseFraction(token);
  }

  // Whole number
  try {
    return parseFloat(token);
  } catch {
    return null;
  }
}

/**
 * Parse fraction string (e.g., "1/2" = 0.5)
 */
function parseFraction(frac: string): number | null {
  const parts = frac.split('/');
  if (parts.length !== 2) {
    return null;
  }

  try {
    const numerator = parseInt(parts[0], 10);
    const denominator = parseInt(parts[1], 10);
    if (denominator === 0) {
      return null;
    }
    return numerator / denominator;
  } catch {
    return null;
  }
}
