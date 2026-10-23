import { AirspaceClass, GeoPoint, NavaidType } from "./ingestion";
import { NavAirspace, NavAirport, NavDataStore, NavNavaid } from "./storage";

export interface PaginationOptions {
  offset?: number;
  limit?: number;
}

export interface ProximityOptions {
  near?: GeoPoint;
  radiusNm?: number;
}

export interface SearchMatch<T> {
  item: T;
  distanceNm?: number;
}

export interface NavSearchResult<T> {
  matches: Array<SearchMatch<T>>;
  total: number;
  offset: number;
  limit: number;
}

export interface AirportSearchOptions extends PaginationOptions, ProximityOptions {
  query?: string;
  types?: string[];
}

export interface NavaidSearchOptions extends PaginationOptions, ProximityOptions {
  query?: string;
  types?: NavaidType[];
}

export interface AirspaceSearchOptions extends PaginationOptions {
  query?: string;
  classes?: AirspaceClass[];
}

export function searchAirports(
  store: NavDataStore,
  options: AirportSearchOptions = {},
): NavSearchResult<NavAirport> {
  const query = normalizeQuery(options.query);
  let matches = Object.values(store.airportsByIcao).filter((airport) => {
    if (!query) {
      return true;
    }
    const name = airport.name.toLowerCase();
    return (
      airport.icao.includes(query) ||
      airport.iata?.includes(query) ||
      name.includes(query.toLowerCase())
    );
  });

  if (options.types?.length) {
    matches = matches.filter((airport) =>
      airport.type ? options.types?.includes(airport.type) : false,
    );
  }

  return paginateWithDistance(matches, options, (airport) => airport.location);
}

export function searchNavaids(
  store: NavDataStore,
  options: NavaidSearchOptions = {},
): NavSearchResult<NavNavaid> {
  const query = normalizeQuery(options.query);
  let matches = Object.values(store.navaidsByIdent).filter((navaid) => {
    if (!query) {
      return true;
    }
    const name = navaid.name?.toLowerCase() ?? "";
    return (
      navaid.identifier.includes(query) ||
      name.includes(query.toLowerCase())
    );
  });

  if (options.types?.length) {
    matches = matches.filter((navaid) => options.types?.includes(navaid.type));
  }

  return paginateWithDistance(matches, options, (navaid) => navaid.position);
}

export function searchAirspaces(
  store: NavDataStore,
  options: AirspaceSearchOptions = {},
): NavSearchResult<NavAirspace> {
  const query = normalizeQuery(options.query);
  let matches = store.airspaces.filter((airspace) => {
    if (!query) {
      return true;
    }
    const name = airspace.name?.toLowerCase() ?? "";
    return (
      airspace.identifier.includes(query) || name.includes(query.toLowerCase())
    );
  });

  if (options.classes?.length) {
    matches = matches.filter((airspace) => options.classes?.includes(airspace.class));
  }

  return paginate(matches, options);
}

function normalizeQuery(query?: string): string | undefined {
  const trimmed = query?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.toUpperCase();
}

function paginate<T>(items: T[], options: PaginationOptions): NavSearchResult<T> {
  const total = items.length;
  const offset = options.offset ?? 0;
  const limit = options.limit ?? total;
  return {
    matches: items.slice(offset, offset + limit).map((item) => ({ item })),
    total,
    offset,
    limit,
  };
}

function paginateWithDistance<T>(
  items: T[],
  options: ProximityOptions & PaginationOptions,
  position: (item: T) => GeoPoint,
): NavSearchResult<T> {
  const near = options.near;
  let matches = items.map((item) => ({ item } as SearchMatch<T>));

  if (near) {
    matches = matches
      .map((match) => ({
        ...match,
        distanceNm: calculateDistanceNm(near, position(match.item)),
      }))
      .filter((match) =>
        options.radiusNm ? match.distanceNm <= options.radiusNm : true,
      )
      .sort((a, b) => (a.distanceNm ?? 0) - (b.distanceNm ?? 0));
  }

  const total = matches.length;
  const offset = options.offset ?? 0;
  const limit = options.limit ?? total;
  return {
    matches: matches.slice(offset, offset + limit),
    total,
    offset,
    limit,
  };
}

function calculateDistanceNm(a: GeoPoint, b: GeoPoint): number {
  const earthRadiusNm = 3440.065;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusNm * centralAngle;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
