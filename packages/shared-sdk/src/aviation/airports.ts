/**
 * Airport database and search functionality
 * 
 * Provides fast, in-memory airport lookups and searches with:
 * - ICAO/IATA code lookups
 * - Text search (fuzzy matching)
 * - Proximity search (haversine distance)
 * - US airport K-prefix handling
 * 
 * @module aviation/airports
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Airport, AirportSearchOptions, AirportCacheEntry } from './types.js';

// Get directory of this module for resolving data file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In-memory cache of all airports
let airportCache: Airport[] | null = null;

/**
 * Load airports from data file (lazy loading)
 * 
 * @returns Array of normalized airport records
 */
async function loadAirportCache(): Promise<Airport[]> {
  if (airportCache !== null) {
    return airportCache;
  }

  try {
    // Load from airports_cache.json in shared-sdk/data/
    const dataPath = join(__dirname, '../../data/airports_cache.json');
    const data = await readFile(dataPath, 'utf-8');
    const rawAirports: AirportCacheEntry[] = JSON.parse(data);
    
    // Normalize all airports on load
    airportCache = rawAirports
      .map(entry => {
        const [lat, lon] = extractLatLon(entry);
        if (lat === null || lon === null) {
          return null;
        }
        return normalizeAirport(entry, lat, lon);
      })
      .filter((airport): airport is Airport => airport !== null);
    
    console.log(`Loaded ${airportCache.length} airports`);
  } catch (error) {
    console.error('Failed to load airport cache:', error);
    airportCache = [];
  }
  
  return airportCache;
}

/**
 * Normalize airport code by extracting leading code from strings like "KPAO - Palo Alto Airport"
 * 
 * @param value - Raw airport code string
 * @returns Normalized uppercase airport code
 * 
 * @example
 * ```ts
 * normalizeAirportCode("KPAO - Palo Alto Airport")  // => "KPAO"
 * normalizeAirportCode("sfo")                       // => "SFO"
 * normalizeAirportCode("  SJC  ")                   // => "SJC"
 * ```
 */
function normalizeAirportCode(value: string): string {
  if (!value) {
    return '';
  }

  // Extract part before dash/hyphen
  const beforeDash = value.trim().split(/\s*[-–—]\s*/)[0];
  const token = beforeDash.trim().split(/\s+/)[0];
  const tokenUpper = token.toUpperCase();

  // Valid airport code: 3-5 alphanumeric characters
  if (/^[A-Z0-9]{3,5}$/.test(tokenUpper)) {
    return tokenUpper;
  }

  return value.trim().toUpperCase();
}

/**
 * Generate candidate codes for airport lookup
 * 
 * Handles US airport K-prefix convention where FAA identifiers are stored
 * as ICAO codes with K prefix (e.g., "7S5" → "K7S5")
 * 
 * @param code - Normalized airport code
 * @returns Set of candidate codes to try
 * 
 * @example
 * ```ts
 * candidateCodes("PAO")   // => Set(["PAO", "KPAO"])
 * candidateCodes("KPAO")  // => Set(["KPAO", "PAO"])
 * candidateCodes("KSFO")  // => Set(["KSFO", "SFO"])
 * ```
 */
function candidateCodes(code: string): Set<string> {
  const codes = new Set<string>([code]);

  // Add K-prefixed version for short US codes
  if (
    code &&
    !code.startsWith('K') &&
    (code.length === 3 || (code.length >= 3 && code.length <= 4 && /\d/.test(code)))
  ) {
    codes.add(`K${code}`);
  }

  // Add version without K prefix
  if (code.startsWith('K') && code.length >= 4 && code.length <= 5) {
    codes.add(code.slice(1));
  }

  return codes;
}

/**
 * Extract latitude and longitude from airport cache entry
 * 
 * Handles various data formats:
 * - GeoJSON geometry { coordinates: [lon, lat] }
 * - Direct fields: lat/latitude, lon/longitude
 * - String or number values
 * 
 * @param airport - Raw airport cache entry
 * @returns Tuple of [latitude, longitude] or [null, null] if not found
 */
function extractLatLon(airport: AirportCacheEntry): [number | null, number | null] {
  // Try GeoJSON format first
  if (airport.geometry?.coordinates && Array.isArray(airport.geometry.coordinates)) {
    const [lon, lat] = airport.geometry.coordinates;
    return [toFloat(lat), toFloat(lon)];
  }

  // Try direct fields
  const lat = toFloat(airport.lat ?? airport.latitude);
  const lon = toFloat(airport.lon ?? airport.longitude);
  return [lat, lon];
}

/**
 * Convert value to float, handling strings and null
 * 
 * @param value - Value to convert
 * @returns Float value or null if invalid
 */
function toFloat(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const num = parseFloat(String(value));
  return isNaN(num) ? null : num;
}

/**
 * Normalize raw airport cache entry to Airport interface
 * 
 * @param entry - Raw airport data
 * @param lat - Latitude (already extracted)
 * @param lon - Longitude (already extracted)
 * @returns Normalized Airport object
 */
function normalizeAirport(entry: AirportCacheEntry, lat: number, lon: number): Airport {
  return {
    icao: (entry.icao || entry.icaoCode || '').toUpperCase(),
    iata: (entry.iata || entry.iataCode || '').toUpperCase(),
    name: entry.name || null,
    city: entry.city || '',
    country: entry.country || '',
    latitude: lat,
    longitude: lon,
    elevation: toFloat(entry.elevation),
    type: entry.type || ''
  };
}

/**
 * Calculate haversine distance between two points on Earth
 * 
 * @param lat1 - Starting latitude in decimal degrees
 * @param lon1 - Starting longitude in decimal degrees
 * @param lat2 - Ending latitude in decimal degrees
 * @param lon2 - Ending longitude in decimal degrees
 * @returns Distance in nautical miles
 * 
 * @example
 * ```ts
 * // Distance from KSFO to KLAX
 * const distanceNm = haversineDistance(37.619, -122.375, 33.942, -118.408);
 * console.log(distanceNm); // ~337 nm
 * ```
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R_NM = 3440.065; // Earth radius in nautical miles

  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R_NM * c;
}

/**
 * Look up an airport by ICAO or IATA code
 * 
 * Supports:
 * - ICAO codes (4 letters, e.g., "KSFO")
 * - IATA codes (3 letters, e.g., "SFO")
 * - US FAA codes with automatic K-prefix handling (e.g., "PAO" → tries "KPAO")
 * - Codes with descriptions (e.g., "KPAO - Palo Alto Airport")
 * 
 * @param code - Airport code (ICAO, IATA, or FAA)
 * @returns Airport object or null if not found
 * 
 * @example
 * ```ts
 * const sfo = await getAirport("KSFO");
 * console.log(sfo.name); // "San Francisco International Airport"
 * 
 * const pao = await getAirport("PAO");  // Automatically tries "KPAO"
 * console.log(pao.icao); // "KPAO"
 * 
 * const lax = await getAirport("LAX");  // IATA code
 * console.log(lax.icao); // "KLAX"
 * ```
 */
export async function getAirport(code: string): Promise<Airport | null> {
  const codeUpper = normalizeAirportCode(code);
  
  // Return null for empty code
  if (!codeUpper) {
    return null;
  }
  
  const candidates = candidateCodes(codeUpper);

  const airports = await loadAirportCache();

  for (const airport of airports) {
    const icao = airport.icao.toUpperCase();
    const iata = airport.iata.toUpperCase();

    // Check if any candidate matches ICAO or IATA
    const match = [icao, iata].some(airportCode => candidates.has(airportCode));
    if (match) {
      return airport;
    }
  }

  return null;
}

/**
 * Search airports by text query
 * 
 * Performs fuzzy search across:
 * - ICAO codes
 * - IATA codes
 * - Airport names
 * - City names
 * - Country names
 * 
 * Results are scored and sorted by relevance:
 * - Exact code match: score 1.0
 * - ICAO starts with query: score 0.95
 * - IATA starts with query: score 0.9
 * - Code contains query: score 0.85
 * - Text contains query: score 0.65
 * - Fuzzy match (SequenceMatcher): score 0.5-0.7
 * 
 * @param query - Search query (case-insensitive)
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of airports sorted by relevance
 * 
 * @example
 * ```ts
 * const results = await searchAirports("San Francisco", 5);
 * results.forEach(airport => {
 *   console.log(`${airport.icao} - ${airport.name}`);
 * });
 * // Output:
 * // KSFO - San Francisco International Airport
 * // KHAF - Half Moon Bay Airport
 * // KOAK - Oakland International Airport
 * ```
 */
export async function searchAirports(query: string, limit: number = 10): Promise<Airport[]> {
  return searchAirportsAdvanced({ query, limit });
}

/**
 * Advanced airport search with text query and/or proximity filtering
 * 
 * Supports:
 * - Text search (fuzzy matching across codes and names)
 * - Proximity search (find airports near a point)
 * - Radius filtering (limit to airports within X nm)
 * - Combined text + proximity search
 * 
 * @param options - Search options
 * @returns Array of airports sorted by relevance or proximity
 * 
 * @example
 * ```ts
 * // Text search
 * const results = await searchAirportsAdvanced({ 
 *   query: "San Francisco", 
 *   limit: 5 
 * });
 * 
 * // Proximity search (all airports within 50nm of SFO)
 * const nearby = await searchAirportsAdvanced({
 *   lat: 37.619,
 *   lon: -122.375,
 *   radius_nm: 50,
 *   limit: 10
 * });
 * 
 * // Combined search (airports matching "tower" within 30nm)
 * const combined = await searchAirportsAdvanced({
 *   query: "tower",
 *   lat: 37.62,
 *   lon: -122.38,
 *   radius_nm: 30,
 *   limit: 5
 * });
 * 
 * console.log(combined[0].distance_nm); // Distance included in results
 * ```
 */
export async function searchAirportsAdvanced(
  options: AirportSearchOptions
): Promise<Airport[]> {
  const { query, limit = 20, lat, lon, radius_nm } = options;

  const q = (query || '').trim().toLowerCase();
  const hasGeo = lat !== undefined && lon !== undefined;

  // Require either query or geo search
  if (!q && !hasGeo) {
    return [];
  }

  const airports = await loadAirportCache();
  const candidates: Array<[number, number, Airport]> = []; // [score, distance, airport]
  const seen = new Set<string>();

  for (const airport of airports) {
    const icao = airport.icao.toUpperCase();
    const iata = airport.iata.toUpperCase();
    const altCodes = candidateCodes(icao);
    const name = airport.name || '';
    const city = airport.city;
    const country = airport.country;

    // Calculate distance if geo search
    let distNm: number | null = null;
    if (hasGeo) {
      distNm = haversineDistance(lat!, lon!, airport.latitude, airport.longitude);
      
      // Filter by radius if specified
      if (radius_nm !== undefined && distNm > radius_nm) {
        continue;
      }
    }

    // Deduplicate by key
    const key = icao || iata || `${airport.latitude},${airport.longitude}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    // Calculate text search score
    let score = 0.0;
    if (q) {
      // Build searchable strings
      const allCodes = Array.from(new Set([icao, iata, ...Array.from(altCodes)])).filter(Boolean);
      const codeHay = allCodes.join(' ').toLowerCase();
      const textHay = `${codeHay} ${name} ${city} ${country}`.toLowerCase();

      // Exact code match
      if (allCodes.some(code => code.toLowerCase() === q)) {
        score = 1.0;
      }
      // ICAO starts with query
      else if (icao.toLowerCase().startsWith(q)) {
        score = 0.95;
      }
      // IATA starts with query
      else if (iata.toLowerCase().startsWith(q)) {
        score = 0.9;
      }
      // Code contains query
      else if (codeHay.includes(q)) {
        score = 0.85;
      }
      // Text contains query
      else if (textHay.includes(q)) {
        score = 0.65;
      }
      // Fuzzy match (similar to Python's difflib.SequenceMatcher)
      else {
        const ratio = Math.max(
          similarity(q, icao.toLowerCase()),
          similarity(q, iata.toLowerCase()),
          similarity(q, name.toLowerCase())
        );
        
        if (ratio < 0.6) {
          continue; // Skip low matches
        }
        
        score = 0.5 + (ratio - 0.6) * 0.5;
      }
    }

    // Clone airport and add distance if geo search
    const result = distNm !== null 
      ? { ...airport, distance_nm: Math.round(distNm * 100) / 100 }
      : airport;

    candidates.push([score, distNm ?? Infinity, result]);
  }

  // Sort by score (desc) then distance (asc)
  if (hasGeo && !q) {
    // Proximity search only: sort by distance
    candidates.sort((a, b) => a[1] - b[1]);
  } else {
    // Text search or combined: sort by score then distance
    candidates.sort((a, b) => {
      if (b[0] !== a[0]) return b[0] - a[0]; // Higher score first
      return a[1] - b[1]; // Closer first
    });
  }

  // Return top results
  return candidates.slice(0, limit).map(([_, __, airport]) => airport);
}

/**
 * Calculate similarity ratio between two strings (similar to Python's difflib.SequenceMatcher)
 * 
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Similarity ratio (0.0 to 1.0)
 */
function similarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  // Simple Levenshtein-based similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * 
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Edit distance
 */
function levenshtein(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}
