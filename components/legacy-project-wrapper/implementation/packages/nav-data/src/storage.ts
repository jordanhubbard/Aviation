import {
  AirspaceClass,
  GeoPoint,
  NavDataSnapshot,
  NavaidType,
  ProcedureLeg,
  ProcedureType,
} from "./ingestion";

export interface NavAirport {
  icao: string;
  iata?: string;
  name: string;
  location: GeoPoint;
  elevationFt?: number;
  type?: string;
  country?: string;
  sources: string[];
}

export interface NavNavaid {
  identifier: string;
  name?: string;
  type: NavaidType;
  position: GeoPoint;
  frequency?: number;
  frequencyUnit?: string;
  sources: string[];
}

export interface NavAirspace {
  identifier: string;
  name?: string;
  class: AirspaceClass;
  lowerLimitFt?: number;
  upperLimitFt?: number;
  boundary: GeoPoint[];
  sources: string[];
}

export interface NavProcedure {
  identifier: string;
  airportIcao?: string;
  type: ProcedureType;
  name?: string;
  transition?: string;
  fixes?: string[];
  legs?: ProcedureLeg[];
  rawRecords?: string[];
  sources: string[];
}

export interface NavDataStore {
  airportsByIcao: Record<string, NavAirport>;
  navaidsByIdent: Record<string, NavNavaid>;
  airspaces: NavAirspace[];
  proceduresByAirport: Record<string, NavProcedure[]>;
}

export function buildNavDataStore(snapshot: NavDataSnapshot): NavDataStore {
  const airportsByIcao: Record<string, NavAirport> = {};
  const navaidsByIdent: Record<string, NavNavaid> = {};
  const airspaceById: Record<string, NavAirspace> = {};
  const proceduresByAirport: Record<string, NavProcedure[]> = {};

  snapshot.airports.forEach((airport) => {
    const existing = airportsByIcao[airport.icao];
    if (existing) {
      mergeSources(existing.sources, airport.source);
      existing.iata ||= airport.iata;
      existing.type ||= airport.type;
      existing.country ||= airport.country;
      return;
    }
    airportsByIcao[airport.icao] = {
      icao: airport.icao,
      iata: airport.iata,
      name: airport.name,
      location: { latitude: airport.latitude, longitude: airport.longitude },
      elevationFt: airport.elevationFt,
      type: airport.type,
      country: airport.country,
      sources: [airport.source],
    };
  });

  snapshot.navaids.forEach((navaid) => {
    const existing = navaidsByIdent[navaid.identifier];
    if (existing) {
      mergeSources(existing.sources, navaid.source);
      existing.name ||= navaid.name;
      existing.frequency ||= navaid.frequency;
      existing.frequencyUnit ||= navaid.frequencyUnit;
      return;
    }
    navaidsByIdent[navaid.identifier] = {
      identifier: navaid.identifier,
      name: navaid.name,
      type: navaid.type,
      position: { latitude: navaid.latitude, longitude: navaid.longitude },
      frequency: navaid.frequency,
      frequencyUnit: navaid.frequencyUnit,
      sources: [navaid.source],
    };
  });

  snapshot.airspaces.forEach((airspace) => {
    const existing = airspaceById[airspace.identifier];
    if (existing) {
      mergeSources(existing.sources, airspace.source);
      existing.name ||= airspace.name;
      return;
    }
    airspaceById[airspace.identifier] = {
      identifier: airspace.identifier,
      name: airspace.name,
      class: airspace.class,
      lowerLimitFt: airspace.lowerLimitFt,
      upperLimitFt: airspace.upperLimitFt,
      boundary: airspace.boundary,
      sources: [airspace.source],
    };
  });

  snapshot.procedures.forEach((procedure) => {
    const airportKey = procedure.airportIcao ?? "UNKNOWN";
    const existingList = proceduresByAirport[airportKey] ?? [];
    const existing = existingList.find((item) => item.identifier === procedure.identifier);
    if (existing) {
      mergeSources(existing.sources, procedure.source);
      if (procedure.rawRecord) {
        existing.rawRecords = existing.rawRecords ?? [];
        existing.rawRecords.push(procedure.rawRecord);
      }
      existing.name ||= procedure.name;
      existing.transition ||= procedure.transition;
      existing.fixes = existing.fixes ?? procedure.fixes;
      existing.legs = existing.legs ?? procedure.legs;
    } else {
      existingList.push({
        identifier: procedure.identifier,
        airportIcao: procedure.airportIcao,
        type: procedure.type,
        name: procedure.name,
        transition: procedure.transition,
        fixes: procedure.fixes,
        legs: procedure.legs,
        rawRecords: procedure.rawRecord ? [procedure.rawRecord] : undefined,
        sources: [procedure.source],
      });
    }
    proceduresByAirport[airportKey] = existingList;
  });

  return {
    airportsByIcao,
    navaidsByIdent,
    airspaces: Object.values(airspaceById),
    proceduresByAirport,
  };
}

function mergeSources(sources: string[], source: string): void {
  if (!sources.includes(source)) {
    sources.push(source);
  }
}
