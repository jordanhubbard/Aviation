import { RawEvent, NormalizedEvent } from './types.js';
import { v4 as uuidv4 } from 'uuid';
import { findAirport } from '../geo/airportLookup.js';

function classifyCategory(raw: RawEvent): 'general' | 'commercial' | 'unknown' {
  const op = (raw.operator || '').toLowerCase();
  if (!op) return 'unknown';
  if (op.includes('airlines') || op.includes('airways') || op.includes('airline')) return 'commercial';
  return 'general';
}

export function normalize(raw: RawEvent): NormalizedEvent {
  const now = new Date().toISOString();
  const airport = raw.airportIcao ? findAirport(raw.airportIcao) : raw.airportIata ? findAirport(raw.airportIata) : undefined;
  return {
    id: uuidv4(),
    dateZ: raw.dateZ,
    registration: raw.registration,
    aircraftType: raw.aircraftType,
    operator: raw.operator,
    category: classifyCategory(raw),
    airportIcao: raw.airportIcao || airport?.icao,
    airportIata: raw.airportIata || airport?.iata,
    country: raw.country || airport?.country,
    region: raw.region,
    lat: raw.lat ?? airport?.latitude,
    lon: raw.lon ?? airport?.longitude,
    fatalities: raw.fatalities,
    injuries: raw.injuries,
    summary: raw.summary,
    narrative: raw.narrative,
    status: raw.status,
    sources: [
      {
        sourceName: raw.source,
        url: raw.url,
        fetchedAt: raw.fetchedAt,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
