export type SourceSystem = 'asn' | 'avherald';

export interface RawEvent {
  source: SourceSystem;
  id: string; // source-specific identifier
  url: string;
  fetchedAt: string; // ISO Z
  dateZ: string; // ISO Z
  registration: string;
  aircraftType?: string;
  operator?: string;
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
  status?: string;
}

export interface NormalizedEvent {
  id: string; // global UUID
  dateZ: string;
  registration: string;
  aircraftType?: string;
  operator?: string;
  category: 'general' | 'commercial' | 'unknown';
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
  status?: string;
  sources: {
    sourceName: string;
    url: string;
    fetchedAt: string;
    checksum?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface IngestResult {
  inserted: number;
  updated: number;
  totalNormalized: number;
}
