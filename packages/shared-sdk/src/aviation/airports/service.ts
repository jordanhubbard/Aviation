/**
 * Airport lookup and search service
 * 
 * Provides airport data lookup by ICAO/IATA codes, name search, and
 * reverse geocoding (nearest airport to coordinates).
 * 
 * Includes LRU caching for improved performance on repeated lookups.
 */

import { Airport, AirportNotFoundError } from './types';
import { airportCodeCache, airportSearchCache, CacheStatistics } from './cache';

/**
 * Airport database (loaded from external source or embedded data)
 */
let airportDatabase: Airport[] = [];

/**
 * Initialize the airport database and warm caches
 * 
 * @param airports - Array of airport records to load
 * @param warmCache - Whether to warm the cache on load (default: true)
 */
export function loadAirportData(airports: Airport[], warmCache: boolean = true): void {
  airportDatabase = airports;
  
  // Clear existing caches
  airportCodeCache.clear();
  airportSearchCache.clear();
  
  console.log(`[airports] Loaded ${airports.length} airports`);
  
  // Warm cache with all airports for fast lookups
  if (warmCache && airports.length > 0) {
    airportCodeCache.warm(airports, (airport) => {
      const keys = [normalizeCode(airport.icao)];
      if (airport.iata) {
        keys.push(normalizeCode(airport.iata));
      }
      return keys;
    });
    console.log(`[airports] Cache warmed with ${airportCodeCache.size()} entries`);
  }
}

/**
 * Get the current airport database
 */
export function getAirportDatabase(): Airport[] {
  return airportDatabase;
}

/**
 * Normalize airport code for lookup
 */
function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Generate candidate codes for lookup
 * Handles US FAA codes (e.g., PAO -> KPAO)
 */
function candidateCodes(code: string): Set<string> {
  const codeUpper = normalizeCode(code);
  const codes = new Set<string>([codeUpper]);

  // Handle K-prefix for US airports
  if (!codeUpper.startsWith('K') && codeUpper.length === 3) {
    codes.add(`K${codeUpper}`);
  }
  
  if (codeUpper.startsWith('K') && codeUpper.length === 4) {
    codes.add(codeUpper.substring(1));
  }

  return codes;
}

/**
 * Find an airport by ICAO or IATA code (with caching)
 * 
 * @param code - ICAO (4-letter) or IATA (3-letter) code
 * @returns Airport record or undefined if not found
 */
export function findAirport(code: string): Airport | undefined {
  const candidates = candidateCodes(code);
  
  // Check cache first - try all candidate codes
  for (const candidate of candidates) {
    const cached = airportCodeCache.get(candidate);
    if (cached) {
      return cached as Airport;
    }
  }

  // Search database
  const found = airportDatabase.find((airport) => {
    const icao = normalizeCode(airport.icao);
    const iata = airport.iata ? normalizeCode(airport.iata) : '';
    
    return candidates.has(icao) || (iata && candidates.has(iata));
  });

  // Cache the result for all candidate codes
  if (found) {
    for (const candidate of candidates) {
      airportCodeCache.set(candidate, found);
    }
  }

  return found;
}

/**
 * Find an airport by code, throw error if not found
 * 
 * @param code - ICAO or IATA code
 * @returns Airport record
 * @throws AirportNotFoundError if not found
 */
export function findAirportRequired(code: string): Airport {
  const airport = findAirport(code);
  if (!airport) {
    throw new AirportNotFoundError(code);
  }
  return airport;
}

/**
 * Search airports by query string (with caching)
 * Searches in ICAO, IATA, name, city, country, and region fields
 * 
 * @param query - Search query
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of matching airports
 */
export function searchAirports(query: string, limit: number = 10): Airport[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const queryLower = query.toLowerCase().trim();
  const cacheKey = `search:${queryLower}:${limit}`;
  
  // Check search cache
  const cached = airportSearchCache.get(cacheKey);
  if (cached) {
    return cached as Airport[];
  }
  
  // Perform search
  const results = airportDatabase.filter((airport) => {
    return (
      airport.icao.toLowerCase().includes(queryLower) ||
      (airport.iata && airport.iata.toLowerCase().includes(queryLower)) ||
      airport.name.toLowerCase().includes(queryLower) ||
      (airport.city && airport.city.toLowerCase().includes(queryLower)) ||
      airport.country.toLowerCase().includes(queryLower) ||
      (airport.region && airport.region.toLowerCase().includes(queryLower))
    );
  });

  const limited = results.slice(0, limit);
  
  // Cache search results
  airportSearchCache.set(cacheKey, limited);
  
  return limited;
}

/**
 * Find the nearest airport to given coordinates
 * 
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @param maxDistanceKm - Maximum distance in kilometers (default: unlimited)
 * @returns Nearest airport or undefined if none within range
 */
export function findNearestAirport(
  lat: number,
  lon: number,
  maxDistanceKm?: number
): Airport | undefined {
  let nearestAirport: Airport | undefined;
  let nearestDistance = Number.MAX_VALUE;

  for (const airport of airportDatabase) {
    const distance = haversineDistance(
      lat,
      lon,
      airport.latitude,
      airport.longitude
    );

    if (distance < nearestDistance) {
      if (maxDistanceKm === undefined || distance <= maxDistanceKm) {
        nearestDistance = distance;
        nearestAirport = airport;
      }
    }
  }

  return nearestAirport;
}

/**
 * Calculate haversine distance between two points
 * 
 * @param lat1 - Latitude 1 in decimal degrees
 * @param lon1 - Longitude 1 in decimal degrees
 * @param lat2 - Latitude 2 in decimal degrees
 * @param lon2 - Longitude 2 in decimal degrees
 * @returns Distance in kilometers
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in kilometers
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get airports within a radius of given coordinates
 * 
 * @param lat - Center latitude in decimal degrees
 * @param lon - Center longitude in decimal degrees
 * @param radiusKm - Radius in kilometers
 * @param limit - Maximum number of results (default: 50)
 * @returns Array of airports within radius, sorted by distance
 */
export function findAirportsNearby(
  lat: number,
  lon: number,
  radiusKm: number,
  limit: number = 50
): Airport[] {
  const nearby: Array<{ airport: Airport; distance: number }> = [];

  for (const airport of airportDatabase) {
    const distance = haversineDistance(
      lat,
      lon,
      airport.latitude,
      airport.longitude
    );

    if (distance <= radiusKm) {
      nearby.push({ airport, distance });
    }
  }

  // Sort by distance and apply limit
  nearby.sort((a, b) => a.distance - b.distance);
  return nearby.slice(0, limit).map((item) => item.airport);
}

/**
 * Get cache statistics for monitoring performance
 * 
 * @returns Combined cache statistics
 */
export function getAirportCacheStats(): {
  codeCache: CacheStatistics;
  searchCache: CacheStatistics;
} {
  return {
    codeCache: airportCodeCache.getStatistics(),
    searchCache: airportSearchCache.getStatistics(),
  };
}

/**
 * Clear all airport caches
 */
export function clearAirportCache(): void {
  airportCodeCache.clear();
  airportSearchCache.clear();
  console.log('[airports] Caches cleared');
}

/**
 * Get most frequently accessed airports
 * 
 * @param limit - Number of airports to return (default: 10)
 * @returns Array of most accessed airports with access counts
 */
export function getMostAccessedAirports(limit: number = 10): Array<{
  airport: Airport;
  accessCount: number;
}> {
  return airportCodeCache.getMostAccessed(limit).map(item => ({
    airport: item.value as Airport,
    accessCount: item.accessCount,
  }));
}
