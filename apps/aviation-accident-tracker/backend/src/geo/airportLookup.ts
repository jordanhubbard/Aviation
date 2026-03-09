import {
  findAirport as findAirportFromSdk,
  searchAirports as searchAirportsFromSdk,
  findAirportsNearby,
} from '@aviation/shared-sdk';

const NM_TO_KM = 1.852;

export function findAirport(code: string) {
  const airport = findAirportFromSdk(code);
  return airport || null;
}

export function searchAirports(query: string, limit = 10) {
  return searchAirportsFromSdk(query, limit);
}

export function reverseLookup(lat: number, lon: number, radiusNm = 50) {
  const radiusKm = radiusNm * NM_TO_KM;
  const results = findAirportsNearby(lat, lon, radiusKm, 1);
  return results[0] || null;
}
