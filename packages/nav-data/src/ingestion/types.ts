export type AirspaceClass =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "G"
  | "SPECIAL"
  | "OTHER";

export type NavaidType = "VOR" | "NDB" | "DME" | "FIX" | "TACAN" | "OTHER";

export type ProcedureType = "SID" | "STAR" | "APPROACH" | "OTHER";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface NormalizedAirport {
  icao: string;
  iata?: string;
  name: string;
  latitude: number;
  longitude: number;
  elevationFt?: number;
  type?: string;
  country?: string;
  source: string;
}

export interface NormalizedNavaid {
  identifier: string;
  name?: string;
  type: NavaidType;
  latitude: number;
  longitude: number;
  frequency?: number;
  frequencyUnit?: string;
  source: string;
}

export interface NormalizedAirspace {
  identifier: string;
  name?: string;
  class: AirspaceClass;
  lowerLimitFt?: number;
  upperLimitFt?: number;
  boundary: GeoPoint[];
  source: string;
}

export interface NormalizedProcedure {
  identifier: string;
  airportIcao?: string;
  type: ProcedureType;
  name?: string;
  fixes?: string[];
  rawRecord?: string;
  source: string;
}

export interface NavDataSnapshot {
  airports: NormalizedAirport[];
  navaids: NormalizedNavaid[];
  airspaces: NormalizedAirspace[];
  procedures: NormalizedProcedure[];
}
