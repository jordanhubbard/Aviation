import fs from 'fs';
import path from 'path';
import { AirportDirectory, Airport } from '@aviation/shared-sdk';

const dataPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data/airports.json');
let directory: AirportDirectory;

function loadAirports(): AirportDirectory {
  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const parsed = JSON.parse(raw) as Array<{
      icao: string;
      iata?: string;
      name: string;
      country: string;
      region?: string;
      lat: number;
      lon: number;
    }>;
    const airports: Airport[] = parsed.map((a) => ({
      icao: a.icao,
      iata: a.iata,
      name: a.name,
      country: a.country,
      region: a.region,
      latitude: a.lat,
      longitude: a.lon,
    }));
    return new AirportDirectory(airports);
  } catch (err) {
    console.warn('[geo] failed to load airports.json, using built-in sample', err);
    const fallback: Airport[] = [
      { icao: 'KSFO', iata: 'SFO', name: 'San Francisco Intl', country: 'US', region: 'CA', latitude: 37.6188, longitude: -122.375 },
      { icao: 'KJFK', iata: 'JFK', name: 'John F Kennedy Intl', country: 'US', region: 'NY', latitude: 40.6413, longitude: -73.7781 },
    ];
    return new AirportDirectory(fallback);
  }
}

directory = loadAirports();

export function findAirport(code: string) {
  return directory.find(code);
}

export function searchAirports(query: string, limit = 10) {
  return directory.search(query, { limit });
}

export function reverseLookup(lat: number, lon: number) {
  return directory.reverse(lat, lon);
}
