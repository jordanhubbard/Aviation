export interface AirportRecord {
  icao: string;
  iata?: string;
  name: string;
  country: string;
  region?: string;
  lat: number;
  lon: number;
}

const airports: AirportRecord[] = [
  { icao: 'KSFO', iata: 'SFO', name: 'San Francisco Intl', country: 'US', region: 'CA', lat: 37.6188, lon: -122.375 },
  { icao: 'KJFK', iata: 'JFK', name: 'John F Kennedy Intl', country: 'US', region: 'NY', lat: 40.6413, lon: -73.7781 },
  { icao: 'EGLL', iata: 'LHR', name: 'London Heathrow', country: 'GB', region: 'ENG', lat: 51.4706, lon: -0.4619 },
  { icao: 'RJTT', iata: 'HND', name: 'Tokyo Haneda', country: 'JP', region: 'JP-13', lat: 35.5494, lon: 139.7798 },
];

export function findAirport(code: string): AirportRecord | undefined {
  const upper = code.toUpperCase();
  return airports.find((a) => a.icao === upper || a.iata === upper);
}

export function reverseLookup(lat: number, lon: number): AirportRecord | undefined {
  // Very naive nearest-airport placeholder
  let best: AirportRecord | undefined;
  let bestDist = Number.MAX_VALUE;
  for (const a of airports) {
    const d = haversine(lat, lon, a.lat, a.lon);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return best;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
