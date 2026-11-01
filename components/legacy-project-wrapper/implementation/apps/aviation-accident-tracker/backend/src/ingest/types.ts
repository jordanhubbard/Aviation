export type SourceSystem = 'asn' | 'avherald' | 'ntsb';

export interface RawEvent {
  source: SourceSystem;
  id: string; // source-specific identifier
  url: string;
  fetchedAt: string; // ISO Z
  dateZ: string; // ISO Z
  registration: string;
  aircraftType?: string;
  operator?: string;
  farPart?: string; // NTSB operation regulation code, when supplied
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
  causeText?: string; // NTSB probable-cause statement or cited findings only
  occurrenceText?: string; // NTSB event sequence, not a probable-cause finding
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
  causes: import('../types.js').CauseAttribution[];
  sources: {
    sourceName: string;
    recordId?: string;
    title?: string;
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
