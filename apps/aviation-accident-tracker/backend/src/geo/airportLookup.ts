/**
 * Airport lookup service for accident-tracker
 * 
 * This module wraps the shared SDK airport services and loads airport data
 * from the local JSON file.
 */

import path from 'path';
import {
  Airport,
  AirportDatabase,
  getAirportByCode,
  searchAirports as sdkSearchAirports,
  findNearbyAirports,
} from '@aviation/shared-sdk';

// Re-export Airport type for backward compatibility
export type AirportRecord = Airport;

// Create airport database instance
const dataPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data/airports.json');
const db = new AirportDatabase(dataPath);

/**
 * Find an airport by ICAO or IATA code
 * @param code - Airport code (ICAO or IATA)
 * @returns Airport record or undefined if not found
 */
export function findAirport(code: string): AirportRecord | undefined {
  return getAirportByCode(code);
}

/**
 * Search airports by query string
 * @param query - Search query
 * @param limit - Maximum number of results
 * @returns Array of matching airports
 */
export function searchAirports(query: string, limit = 10): AirportRecord[] {
  return sdkSearchAirports(query, limit);
}

/**
 * Find the nearest airport to given coordinates
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Nearest airport or undefined
 */
export function reverseLookup(lat: number, lon: number): AirportRecord | undefined {
  const nearby = findNearbyAirports(lat, lon, 50, 1); // 50nm radius, 1 result
  return nearby.length > 0 ? nearby[0] : undefined;
}
