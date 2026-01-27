import { ProcedureType } from "./ingestion";
import { NavDataStore, NavProcedure } from "./storage";
import { NavSearchResult, PaginationOptions, SearchMatch } from "./search";

export interface ProcedureQueryOptions extends PaginationOptions {
  type?: ProcedureType;
  query?: string;
}

export function listProceduresForAirport(
  store: NavDataStore,
  airportIcao: string,
  options: ProcedureQueryOptions = {},
): NavSearchResult<NavProcedure> {
  const airportKey = airportIcao.trim().toUpperCase();
  const procedures = store.proceduresByAirport[airportKey] ?? [];
  const query = normalizeQuery(options.query);

  let matches = procedures.filter((procedure) => {
    if (options.type && procedure.type !== options.type) {
      return false;
    }
    if (!query) {
      return true;
    }
    const name = procedure.name?.toLowerCase() ?? "";
    return (
      procedure.identifier.includes(query) || name.includes(query.toLowerCase())
    );
  });

  const total = matches.length;
  const offset = options.offset ?? 0;
  const limit = options.limit ?? total;
  const paged = matches.slice(offset, offset + limit).map((item) => ({
    item,
  } as SearchMatch<NavProcedure>));

  return {
    matches: paged,
    total,
    offset,
    limit,
  };
}

function normalizeQuery(query?: string): string | undefined {
  const trimmed = query?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.toUpperCase();
}
