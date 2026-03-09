import { ingestCifpProcedures } from "./cifp";
import { mergeSnapshots, emptySnapshot } from "./merge";
import { ingestOpenAipAirspace } from "./openaip";
import { ingestOurAirportsAirports, ingestOurAirportsNavaids } from "./ourairports";
import { NavDataSnapshot } from "./types";

export interface NavDataIngestionInput {
  ourAirports?: {
    airportsCsv?: string;
    navaidsCsv?: string;
  };
  openAip?: {
    airspace?: unknown;
  };
  faaCifp?: {
    records?: string | string[];
  };
}

export function ingestNavData(input: NavDataIngestionInput): NavDataSnapshot {
  const snapshots: NavDataSnapshot[] = [];
  if (input.ourAirports?.airportsCsv || input.ourAirports?.navaidsCsv) {
    snapshots.push({
      airports: input.ourAirports.airportsCsv
        ? ingestOurAirportsAirports(input.ourAirports.airportsCsv)
        : [],
      navaids: input.ourAirports.navaidsCsv
        ? ingestOurAirportsNavaids(input.ourAirports.navaidsCsv)
        : [],
      airspaces: [],
      procedures: [],
    });
  }
  if (input.openAip?.airspace) {
    snapshots.push({
      airports: [],
      navaids: [],
      airspaces: ingestOpenAipAirspace(input.openAip.airspace),
      procedures: [],
    });
  }
  if (input.faaCifp?.records) {
    snapshots.push({
      airports: [],
      navaids: [],
      airspaces: [],
      procedures: ingestCifpProcedures(input.faaCifp.records),
    });
  }
  if (snapshots.length === 0) {
    return emptySnapshot();
  }
  return mergeSnapshots(...snapshots);
}

export { ingestCifpProcedures } from "./cifp";
export { ingestOpenAipAirspace } from "./openaip";
export { ingestOurAirportsAirports, ingestOurAirportsNavaids } from "./ourairports";
export { mergeSnapshots } from "./merge";
export type {
  AirspaceClass,
  GeoPoint,
  NavDataSnapshot,
  NavaidType,
  NormalizedAirspace,
  NormalizedAirport,
  NormalizedNavaid,
  NormalizedProcedure,
  ProcedureAltitudeConstraint,
  ProcedureAltitudeConstraintType,
  ProcedureLeg,
  ProcedureSpeedConstraint,
  ProcedureSpeedConstraintType,
  ProcedureType,
} from "./types";
