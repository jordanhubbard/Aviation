import { AirportDatabase } from '@aviation/shared-sdk';

// Use the built-in shared SDK airport database
const airportDb = new AirportDatabase();

export function findAirport(code: string) {
  // Try ICAO first, then IATA using the shared SDK method
  const airport = airportDb.getByIcao(code) || airportDb.getByIata(code);
  return airport || null;
}

export function searchAirports(query: string, limit = 10) {
  // Search by name using shared SDK
  return airportDb.search(query, limit);
}

export function reverseLookup(lat: number, lon: number, radiusNm = 50) {
  // Find nearest airports within radius
  const results = airportDb.findNearby(lat, lon, radiusNm, 1);
  return results[0] || null; // Return closest airport
}
