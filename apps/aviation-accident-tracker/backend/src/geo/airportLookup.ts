export interface AirportRecord {
  icao: string;
  iata?: string;
  name: string;
  country: string;
  region?: string;
  lat: number;
  lon: number;
}

// Minimal embedded dataset (major hubs). Replace with full OurAirports/OpenFlights
// data when wiring real ingestion.
const airports: AirportRecord[] = [
  { icao: 'KSFO', iata: 'SFO', name: 'San Francisco Intl', country: 'US', region: 'CA', lat: 37.6188, lon: -122.375 },
  { icao: 'KLAX', iata: 'LAX', name: 'Los Angeles Intl', country: 'US', region: 'CA', lat: 33.9425, lon: -118.4081 },
  { icao: 'KJFK', iata: 'JFK', name: 'John F Kennedy Intl', country: 'US', region: 'NY', lat: 40.6413, lon: -73.7781 },
  { icao: 'KSEA', iata: 'SEA', name: 'Seattle Tacoma Intl', country: 'US', region: 'WA', lat: 47.4502, lon: -122.3088 },
  { icao: 'KDEN', iata: 'DEN', name: 'Denver Intl', country: 'US', region: 'CO', lat: 39.8561, lon: -104.6737 },
  { icao: 'KORD', iata: 'ORD', name: "Chicago O'Hare Intl", country: 'US', region: 'IL', lat: 41.9742, lon: -87.9073 },
  { icao: 'CYYZ', iata: 'YYZ', name: 'Toronto Pearson Intl', country: 'CA', region: 'ON', lat: 43.6777, lon: -79.6248 },
  { icao: 'CYVR', iata: 'YVR', name: 'Vancouver Intl', country: 'CA', region: 'BC', lat: 49.1947, lon: -123.1792 },
  { icao: 'EGLL', iata: 'LHR', name: 'London Heathrow', country: 'GB', region: 'ENG', lat: 51.4706, lon: -0.4619 },
  { icao: 'LFPG', iata: 'CDG', name: 'Paris Charles de Gaulle', country: 'FR', region: 'IDF', lat: 49.0097, lon: 2.5479 },
  { icao: 'EDDF', iata: 'FRA', name: 'Frankfurt Main', country: 'DE', region: 'HE', lat: 50.0379, lon: 8.5622 },
  { icao: 'RJTT', iata: 'HND', name: 'Tokyo Haneda', country: 'JP', region: 'JP-13', lat: 35.5494, lon: 139.7798 },
  { icao: 'RJAA', iata: 'NRT', name: 'Tokyo Narita', country: 'JP', region: 'JP-12', lat: 35.7647, lon: 140.3864 },
  { icao: 'ZBAA', iata: 'PEK', name: 'Beijing Capital', country: 'CN', region: 'CN-11', lat: 40.0799, lon: 116.6031 },
  { icao: 'OMDB', iata: 'DXB', name: 'Dubai Intl', country: 'AE', region: 'AE-DU', lat: 25.2532, lon: 55.3657 },
  { icao: 'YSSY', iata: 'SYD', name: 'Sydney Kingsford Smith', country: 'AU', region: 'NSW', lat: -33.9399, lon: 151.1753 },
  { icao: 'NZAA', iata: 'AKL', name: 'Auckland Intl', country: 'NZ', region: 'AUK', lat: -37.0082, lon: 174.785 },
  { icao: 'SBGR', iata: 'GRU', name: 'São Paulo–Guarulhos', country: 'BR', region: 'SP', lat: -23.4356, lon: -46.4731 },
  { icao: 'FAOR', iata: 'JNB', name: 'Johannesburg OR Tambo', country: 'ZA', region: 'GP', lat: -26.1337, lon: 28.2423 },
  { icao: 'VIDP', iata: 'DEL', name: 'Delhi Indira Gandhi', country: 'IN', region: 'DL', lat: 28.5562, lon: 77.100 }
];

const cache = new Map<string, AirportRecord>();

export function findAirport(code: string): AirportRecord | undefined {
  const upper = code.toUpperCase();
  if (cache.has(upper)) return cache.get(upper);
  const found = airports.find((a) => a.icao === upper || a.iata === upper || a.icao.startsWith(upper) || a.iata === upper);
  if (found) cache.set(upper, found);
  return found;
}

export function reverseLookup(lat: number, lon: number): AirportRecord | undefined {
  // Naive nearest-airport search over small set
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
