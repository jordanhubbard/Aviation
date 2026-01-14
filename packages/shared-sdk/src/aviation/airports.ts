/**
 * Airport Database and Search
 * 
 * Provides airport lookup, search, and geospatial queries for aviation applications.
 * Extracted from flightplanner for shared use across the monorepo.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Airport data structure
 */
export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  type?: string;
  distance_nm?: number; // Only populated in proximity searches
}

/**
 * Raw airport data from JSON file
 */
interface RawAirport {
  icao?: string;
  icaoCode?: string;
  iata?: string;
  iataCode?: string;
  name?: string;
  city?: string;
  country?: string;
  latitude?: number;
  lat?: number;
  longitude?: number;
  lon?: number;
  elevation?: number;
  type?: string;
  geometry?: {
    coordinates?: [number, number];
  };
}

/**
 * Airport search options
 */
export interface AirportSearchOptions {
  query?: string;
  limit?: number;
  latitude?: number;
  longitude?: number;
  radiusNm?: number;
}

/**
 * Airport database class for loading, caching, and searching airports
 */
export class AirportDatabase {
  private airports: RawAirport[] = [];
  private loaded: boolean = false;
  private dataPath: string;

  constructor(dataPath?: string) {
    this.dataPath = dataPath || path.join(__dirname, '../../data/airports_cache.json');
  }

  /**
   * Load airport data from JSON file
   */
  private loadAirports(): void {
    if (this.loaded) return;

    try {
      const data = fs.readFileSync(this.dataPath, 'utf8');
      this.airports = JSON.parse(data);
      this.loaded = true;
    } catch (error) {
      console.error('Failed to load airport data:', error);
      this.airports = [];
    }
  }

  /**
   * Normalize airport code (extract leading code from "KPAO - Palo Alto Airport")
   */
  private normalizeAirportCode(value: string): string {
    if (!value) return '';

    // Split on various dash characters
    const beforeDash = value.trim().split(/\s*[-–—]\s*/)[0];
    const token = beforeDash.trim().split(/\s+/)[0] || '';
    const tokenU = token.toUpperCase();

    // Valid airport code: 3-5 alphanumeric characters
    if (/^[A-Z0-9]{3,5}$/.test(tokenU)) {
      return tokenU;
    }

    return value.trim().toUpperCase();
  }

  /**
   * Generate candidate codes for lookup (handles K-prefix for US airports)
   */
  private candidateCodes(codeU: string): Set<string> {
    const codes = new Set<string>([codeU]);

    // US local identifiers as pseudo-ICAO codes prefixed with 'K' (e.g., 7S5 -> K7S5)
    if (
      codeU &&
      !codeU.startsWith('K') &&
      (codeU.length === 3 || (codeU.length >= 3 && codeU.length <= 4 && /\d/.test(codeU)))
    ) {
      codes.add(`K${codeU}`);
    }

    // Also try without K prefix
    if (codeU.startsWith('K') && codeU.length >= 4 && codeU.length <= 5) {
      codes.add(codeU.substring(1));
    }

    return codes;
  }

  /**
   * Extract latitude and longitude from airport data
   */
  private extractLatLon(airport: RawAirport): [number | null, number | null] {
    // Try geometry.coordinates first (GeoJSON format)
    if (airport.geometry?.coordinates && Array.isArray(airport.geometry.coordinates)) {
      const [lon, lat] = airport.geometry.coordinates;
      return [this.toFloat(lat), this.toFloat(lon)];
    }

    // Try direct latitude/longitude fields
    const lat = this.toFloat(airport.lat || airport.latitude);
    const lon = this.toFloat(airport.lon || airport.longitude);
    return [lat, lon];
  }

  /**
   * Convert value to float, returning null if invalid
   */
  private toFloat(v: any): number | null {
    if (v === null || v === undefined) return null;
    const num = parseFloat(v);
    return isNaN(num) ? null : num;
  }

  /**
   * Calculate haversine distance in nautical miles
   */
  private haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R_NM = 3440.065; // Earth radius in nautical miles
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dphi = ((lat2 - lat1) * Math.PI) / 180;
    const dlambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dphi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R_NM * c;
  }

  /**
   * Calculate sequence similarity ratio (simple version of Python's SequenceMatcher)
   */
  private similarityRatio(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    if (len1 === 0 || len2 === 0) return 0;

    // Simple approach: count matching characters in order
    let matches = 0;
    let i = 0;
    let j = 0;

    while (i < len1 && j < len2) {
      if (s1[i] === s2[j]) {
        matches++;
        i++;
        j++;
      } else {
        j++;
      }
    }

    return (2.0 * matches) / (len1 + len2);
  }

  /**
   * Get airport coordinates by ICAO or IATA code
   */
  getAirportCoordinates(code: string): Airport | null {
    this.loadAirports();

    const codeU = this.normalizeAirportCode(code);
    const candidates = this.candidateCodes(codeU);

    for (const airport of this.airports) {
      const icaoCode = (airport.icao || airport.icaoCode || '').toUpperCase();
      const iataCode = (airport.iata || airport.iataCode || '').toUpperCase();

      // Check if any candidate code matches
      if (![icaoCode, iataCode].some(c => candidates.has(c))) {
        continue;
      }

      const [lat, lon] = this.extractLatLon(airport);
      if (lat === null || lon === null) {
        continue;
      }

      return {
        icao: icaoCode,
        iata: iataCode,
        name: airport.name || '',
        city: airport.city || '',
        country: airport.country || '',
        latitude: lat,
        longitude: lon,
        elevation: airport.elevation,
        type: airport.type,
      };
    }

    return null;
  }

  /**
   * Search airports by query string and/or proximity
   */
  searchAirports(options: AirportSearchOptions): Airport[] {
    this.loadAirports();

    const query = (options.query || '').trim().toLowerCase();
    const limit = options.limit || 20;
    const hasGeo = options.latitude !== undefined && options.longitude !== undefined;

    if (!query && !hasGeo) {
      return [];
    }

    const candidates: Array<[number, number, Airport]> = [];
    const seen = new Set<string>();

    for (const airport of this.airports) {
      const icaoCode = (airport.icao || airport.icaoCode || '').toUpperCase();
      const iataCode = (airport.iata || airport.iataCode || '').toUpperCase();
      const altCodes = this.candidateCodes(icaoCode);
      const name = airport.name || '';
      const city = airport.city || '';
      const country = airport.country || '';

      const [lat, lon] = this.extractLatLon(airport);
      if (lat === null || lon === null) {
        continue;
      }

      // Calculate distance if geo coordinates provided
      let distNm: number | null = null;
      if (hasGeo) {
        distNm = this.haversineNm(
          options.latitude!,
          options.longitude!,
          lat,
          lon
        );

        // Filter by radius if specified
        if (options.radiusNm !== undefined && distNm > options.radiusNm) {
          continue;
        }
      }

      // Normalize airport data
      const normalized: Airport = {
        icao: icaoCode,
        iata: iataCode,
        name: name,
        city: city,
        country: country,
        latitude: lat,
        longitude: lon,
        elevation: airport.elevation,
        type: airport.type || '',
      };

      // Deduplicate by key
      const key = normalized.icao || normalized.iata || `${normalized.latitude},${normalized.longitude}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      // Calculate search score if query provided
      let score = 0.0;
      if (query) {
        const allCodes = [icaoCode, iataCode, ...Array.from(altCodes)].filter(c => c);
        const codeHay = allCodes.join(' ').toLowerCase();
        const textHay = `${codeHay} ${name} ${city} ${country}`.toLowerCase();

        // Exact code match
        if (allCodes.some(c => c.toLowerCase() === query)) {
          score = 1.0;
        }
        // ICAO starts with query
        else if (icaoCode.toLowerCase().startsWith(query)) {
          score = 0.95;
        }
        // IATA starts with query
        else if (iataCode.toLowerCase().startsWith(query)) {
          score = 0.9;
        }
        // Code contains query
        else if (codeHay.includes(query)) {
          score = 0.85;
        }
        // Text contains query
        else if (textHay.includes(query)) {
          score = 0.65;
        }
        // Fuzzy match
        else {
          const ratio = Math.max(
            this.similarityRatio(query, icaoCode.toLowerCase()),
            this.similarityRatio(query, iataCode.toLowerCase()),
            this.similarityRatio(query, name.toLowerCase())
          );

          if (ratio < 0.6) {
            continue; // Skip low-quality matches
          }

          score = 0.5 + (ratio - 0.6) * 0.5;
        }
      }

      // Add distance to result if available
      if (distNm !== null) {
        normalized.distance_nm = Math.round(distNm * 100) / 100;
      }

      candidates.push([score, distNm !== null ? distNm : Infinity, normalized]);
    }

    // Sort by score (descending) then distance (ascending)
    if (hasGeo && !query) {
      // Proximity search only: sort by distance
      candidates.sort((a, b) => a[1] - b[1]);
    } else {
      // Text search or combined: sort by score then distance
      candidates.sort((a, b) => {
        if (b[0] !== a[0]) return b[0] - a[0]; // Higher score first
        return a[1] - b[1]; // Then closer distance
      });
    }

    return candidates.slice(0, limit).map(item => item[2]);
  }

  /**
   * Simple search by query string only (convenience method)
   */
  search(query: string, limit: number = 20): Airport[] {
    return this.searchAirports({ query, limit });
  }

  /**
   * Find airports near a location
   */
  findNearby(latitude: number, longitude: number, radiusNm: number, limit: number = 20): Airport[] {
    return this.searchAirports({ latitude, longitude, radiusNm, limit });
  }

  /**
   * Get airport by ICAO code (convenience method)
   */
  getByIcao(icao: string): Airport | null {
    return this.getAirportCoordinates(icao);
  }

  /**
   * Get airport by IATA code (convenience method)
   */
  getByIata(iata: string): Airport | null {
    return this.getAirportCoordinates(iata);
  }
}

/**
 * Singleton instance for convenience
 */
let defaultDatabase: AirportDatabase | null = null;

export function getAirportDatabase(dataPath?: string): AirportDatabase {
  if (!defaultDatabase || dataPath) {
    defaultDatabase = new AirportDatabase(dataPath);
  }
  return defaultDatabase;
}

/**
 * Convenience functions using singleton database
 */
export function searchAirports(query: string, limit?: number): Airport[] {
  return getAirportDatabase().search(query, limit);
}

export function getAirportByCode(code: string): Airport | null {
  return getAirportDatabase().getAirportCoordinates(code);
}

export function findNearbyAirports(
  latitude: number,
  longitude: number,
  radiusNm: number,
  limit?: number
): Airport[] {
  return getAirportDatabase().findNearby(latitude, longitude, radiusNm, limit);
}
