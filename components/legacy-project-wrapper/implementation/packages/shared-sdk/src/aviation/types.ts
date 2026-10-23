/**
 * Aviation types for airports, weather, navigation, etc.
 * Part of @aviation/shared-sdk
 */

// ============================================================================
// Airport Types
// ============================================================================

/**
 * Airport information with coordinates and metadata
 */
export interface Airport {
  /** ICAO airport code (4 letters, e.g., "KSFO") */
  icao: string;

  /** IATA airport code (3 letters, e.g., "SFO") */
  iata: string;

  /** Airport name (e.g., "San Francisco International Airport") */
  name: string | null;

  /** City where airport is located */
  city: string;

  /** Country where airport is located */
  country: string;

  /** Latitude in decimal degrees */
  latitude: number;

  /** Longitude in decimal degrees */
  longitude: number;

  /** Elevation in feet MSL (Mean Sea Level) */
  elevation: number | null;

  /** Airport type (e.g., "large_airport", "medium_airport", "small_airport") */
  type: string;

  /** Distance from reference point in nautical miles (only in proximity search results) */
  distance_nm?: number;
}

/**
 * Airport search options
 */
export interface AirportSearchOptions {
  /** Text query (airport code, name, city) */
  query?: string;

  /** Maximum number of results to return */
  limit?: number;

  /** Reference latitude for proximity search */
  lat?: number;

  /** Reference longitude for proximity search */
  lon?: number;

  /** Search radius in nautical miles (only with lat/lon) */
  radius_nm?: number;
}

/**
 * Raw airport data from cache (flexible structure)
 */
export interface AirportCacheEntry {
  icao?: string;
  icaoCode?: string;
  iata?: string;
  iataCode?: string;
  name?: string;
  city?: string;
  country?: string;
  lat?: number | string;
  latitude?: number | string;
  lon?: number | string;
  longitude?: number | string;
  elevation?: number | string | null;
  type?: string;
  geometry?: {
    coordinates?: [number, number]; // [lon, lat] GeoJSON order
  };
}
