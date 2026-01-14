/**
 * Airport lookup service for accident-tracker
 * 
 * This module wraps the shared SDK airport services and loads airport data
 * from the local JSON file.
 */

import fs from 'fs';
import path from 'path';
import {
  Airport,
  loadAirportData,
  findAirport as sdkFindAirport,
  findNearestAirport,
  searchAirports as sdkSearchAirports,
} from '@aviation/shared-sdk';

// Re-export Airport type for backward compatibility
export type AirportRecord = Airport;

// Load airport data from local JSON file
const dataPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data/airports.json');

try {
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const airports = JSON.parse(raw) as Airport[];
  loadAirportData(airports);
  console.log(`[geo] Loaded ${airports.length} airports from ${dataPath}`);
} catch (err) {
  console.warn('[geo] Failed to load airports.json, using fallback sample data', err);
  // Load minimal fallback data
  loadAirportData([
    { icao: 'KSFO', iata: 'SFO', name: 'San Francisco Intl', country: 'US', region: 'CA', latitude: 37.6188, longitude: -122.375 },
    { icao: 'KJFK', iata: 'JFK', name: 'John F Kennedy Intl', country: 'US', region: 'NY', latitude: 40.6413, longitude: -73.7781 },
  ]);
}

/**
 * Find an airport by ICAO or IATA code
 * @param code - Airport code (ICAO or IATA)
 * @returns Airport record or undefined if not found
 */
export function findAirport(code: string): AirportRecord | undefined {
  return sdkFindAirport(code);
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
  return findNearestAirport(lat, lon);
}
