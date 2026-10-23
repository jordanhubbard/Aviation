export type Category = 'general' | 'commercial' | 'unknown';

export interface SourceAttribution {
  sourceName: string;
  url: string;
  fetchedAt: string; // ISO in Z
  checksum?: string;
}

export interface EventRecord {
  id: string;
  dateZ: string; // ISO in Z
  registration: string;
  aircraftType?: string;
  operator?: string;
  category: Category;
  airportIcao?: string;
  airportIata?: string;
  country?: string;
  region?: string;
  lat?: number;
  lon?: number;
  fatalities?: number;
  injuries?: number;
  summary?: string;
  narrative?: string;
  status?: string; // preliminary/final/unknown
  sources: SourceAttribution[];
  createdAt: string;
  updatedAt: string;
}

export interface ListEventsParams {
  from?: string;
  to?: string;
  category?: Category | 'all';
  airport?: string;
  country?: string;
  region?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
