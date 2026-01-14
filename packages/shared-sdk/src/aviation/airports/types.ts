/**
 * Type definitions for aviation airport services
 * 
 * This module provides TypeScript types for airport data and lookup operations.
 */

/**
 * Airport record with location and identification data
 */
export interface Airport {
  /** ICAO airport code (4 letters) */
  icao: string;
  /** IATA airport code (3 letters, optional) */
  iata?: string;
  /** Airport name */
  name: string;
  /** City name */
  city?: string;
  /** Country code (ISO 2-letter) */
  country: string;
  /** State/region code */
  region?: string;
  /** Latitude in decimal degrees */
  latitude: number;
  /** Longitude in decimal degrees */
  longitude: number;
  /** Elevation in feet MSL */
  elevation?: number;
  /** Airport type (e.g., large_airport, small_airport, heliport) */
  type?: string;
}

/**
 * Search results for airport queries
 */
export interface AirportSearchResult {
  /** Matching airports */
  airports: Airport[];
  /** Total number of results */
  total: number;
  /** Query that was executed */
  query: string;
}

/**
 * Error class for airport service errors
 */
export class AirportError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'AirportError';
  }
}

/**
 * Error when airport is not found
 */
export class AirportNotFoundError extends AirportError {
  constructor(code: string) {
    super(`Airport not found: ${code}`);
    this.name = 'AirportNotFoundError';
  }
}
