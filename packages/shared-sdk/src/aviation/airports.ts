export interface Airport {
  icao: string;
  iata?: string;
  name: string;
  country: string;
  region?: string;
  latitude: number;
  longitude: number;
}

export interface AirportSearchOptions {
  limit?: number;
  country?: string;
  region?: string;
}

/**
 * Lightweight in-memory airport directory for shared lookup/search.
 */
export class AirportDirectory {
  private airports: Airport[];
  private byCode: Map<string, Airport>;

  constructor(airports: Airport[]) {
    this.airports = airports;
    this.byCode = new Map();
    for (const a of airports) {
      this.byCode.set(a.icao.toUpperCase(), a);
      if (a.iata) this.byCode.set(a.iata.toUpperCase(), a);
    }
  }

  find(code: string): Airport | undefined {
    return this.byCode.get(code.toUpperCase());
  }

  search(query: string, options: AirportSearchOptions = {}): Airport[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const limit = options.limit ?? 20;
    const filtered = this.airports.filter((a) => {
      if (options.country && a.country !== options.country) return false;
      if (options.region && a.region !== options.region) return false;
      return (
        a.icao.toLowerCase().includes(q) ||
        (a.iata && a.iata.toLowerCase().includes(q)) ||
        a.name.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q) ||
        (a.region && a.region.toLowerCase().includes(q))
      );
    });
    return filtered.slice(0, limit);
  }

  reverse(lat: number, lon: number): Airport | undefined {
    let best: Airport | undefined;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const a of this.airports) {
      const d = haversine(lat, lon, a.latitude, a.longitude);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return best;
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
