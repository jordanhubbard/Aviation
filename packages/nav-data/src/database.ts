import {
  AirspaceSearchOptions,
  AirportSearchOptions,
  NavSearchResult,
  NavaidSearchOptions,
  searchAirports,
  searchAirspaces,
  searchNavaids,
} from "./search";
import { ProcedureQueryOptions, listProceduresForAirport } from "./procedures";
import {
  NavAirspace,
  NavAirport,
  NavDataStore,
  NavNavaid,
  NavProcedure,
} from "./storage";

export class NavDatabase {
  constructor(private readonly store: NavDataStore) {}

  getAirport(icao: string): NavAirport | undefined {
    const key = icao.trim().toUpperCase();
    return this.store.airportsByIcao[key];
  }

  getNavaid(identifier: string): NavNavaid | undefined {
    const key = identifier.trim().toUpperCase();
    return this.store.navaidsByIdent[key];
  }

  listAirspaces(): NavAirspace[] {
    return this.store.airspaces;
  }

  searchAirports(options?: AirportSearchOptions): NavSearchResult<NavAirport> {
    return searchAirports(this.store, options);
  }

  searchNavaids(options?: NavaidSearchOptions): NavSearchResult<NavNavaid> {
    return searchNavaids(this.store, options);
  }

  searchAirspaces(options?: AirspaceSearchOptions): NavSearchResult<NavAirspace> {
    return searchAirspaces(this.store, options);
  }

  listProcedures(
    airportIcao: string,
    options?: ProcedureQueryOptions,
  ): NavSearchResult<NavProcedure> {
    return listProceduresForAirport(this.store, airportIcao, options);
  }
}
