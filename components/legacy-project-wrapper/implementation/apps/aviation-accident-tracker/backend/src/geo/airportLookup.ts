import {
  findAirport as findAirportFromSdk,
  searchAirports as searchAirportsFromSdk,
  findAirportsNearby,
} from '@aviation/shared-sdk';
import { loadBundledAirports } from '@aviation/shared-sdk/aviation/airports/bundled';

const NM_TO_KM = 1.852;

// The SDK airport service starts empty; without this the lookups below silently
// return nothing. Loading is idempotent and deferred so the 80k-record dataset is
// only parsed if something actually asks for an airport.
let loaded = false;
function ensureAirportData() {
  if (!loaded) {
    loadBundledAirports();
    loaded = true;
  }
}

export function findAirport(code: string) {
  ensureAirportData();
  const airport = findAirportFromSdk(code);
  return airport || null;
}

export function searchAirports(query: string, limit = 10) {
  ensureAirportData();
  return searchAirportsFromSdk(query, limit);
}

export function reverseLookup(lat: number, lon: number, radiusNm = 50) {
  ensureAirportData();
  const radiusKm = radiusNm * NM_TO_KM;
  const results = findAirportsNearby(lat, lon, radiusKm, 1);
  return results[0] || null;
}
