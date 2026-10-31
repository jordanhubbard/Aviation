/**
 * In-flight Hazard Layer: SIGMETs / AIRMETs / TFRs
 *
 * Provides normalized types and utilities for fetching, parsing, and evaluating
 * aviation hazards from aviationweather.gov (SIGMETs / AIRMETs) and the FAA
 * TFR GeoJSON feed.
 *
 * All external I/O is injectable (fetchFn parameter) so tests can be fully
 * hermetic with no live network calls.
 *
 * @module @aviation/shared-sdk/aviation/hazards
 */

// ---------------------------------------------------------------------------
// Geometry helpers (no external deps)
// ---------------------------------------------------------------------------

/** A latitude/longitude coordinate pair. */
export interface LatLon {
  lat: number;
  lon: number;
}

/** A simple polygon defined as a closed ring of lat/lon vertices. */
export interface GeoPolygon {
  type: 'Polygon';
  /** Outer ring (first and last vertex must be equal for a closed ring,
   *  but the helpers below treat the ring as implicitly closed). */
  coordinates: LatLon[];
}

/** A point geometry. */
export interface GeoPoint {
  type: 'Point';
  coordinate: LatLon;
}

export type HazardGeometry = GeoPolygon | GeoPoint;

// ---------------------------------------------------------------------------
// Core Hazard type
// ---------------------------------------------------------------------------

export type HazardKind = 'SIGMET' | 'AIRMET' | 'TFR';

export type HazardSeverity =
  | 'advisory' // AIRMETs, low-level TFRs
  | 'watch'    // non-convective SIGMETs, most AIRMETs
  | 'warning'  // convective SIGMETs
  | 'emergency'; // security TFRs (e.g. SFRA), NOTAM TFRs with hard floor

/** Normalized representation of a SIGMET, AIRMET, or TFR. */
export interface Hazard {
  /** Unique identifier (FAA series + sequence, or TFR notam number). */
  id: string;
  kind: HazardKind;
  /**
   * Sub-type label.
   * SIGMETs: 'CONVECTIVE' | 'NON-CONVECTIVE' | 'SIERRA' | 'TANGO' | 'ZULU'
   * AIRMETs: 'SIERRA' (IFR + mountains) | 'TANGO' (turbulence) | 'ZULU' (icing)
   * TFRs:   'SECURITY' | 'VIP' | 'SPECIAL_EVENT' | 'FIRE' | 'OTHER'
   */
  subType: string;
  /** Short plain-English summary. */
  summary: string;
  geometry: HazardGeometry;
  /** Altitude band in feet MSL. null means surface / unlimited. */
  altitudeBandFt: { floor: number | null; ceiling: number | null };
  validFrom: Date;
  validTo: Date;
  severity: HazardSeverity;
  /** Raw text from the source (SIGMET text, TFR NOTAM text, etc.). */
  rawText?: string;
  /** Source URL that was fetched. */
  sourceUrl?: string;
}

export interface HazardRecordInput {
  id: string;
  kind: HazardKind | string;
  subType: string;
  summary: string;
  geometry: HazardGeometry;
  altitudeBandFt: { floor: number | null; ceiling: number | null };
  validFrom: Date | string;
  validTo: Date | string;
  rawText?: string;
  sourceUrl?: string;
}

export class HazardValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'HazardValidationError';
  }
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface HazardClientOptions {
  /** Override the aviationweather.gov base URL (for testing). */
  awcBaseUrl?: string;
  /** Override the FAA TFR base URL (for testing). */
  faaBaseUrl?: string;
  /** Injectable fetch function — defaults to global fetch. */
  fetchFn?: typeof fetch;
}

// ---------------------------------------------------------------------------
// Raw response shapes (internal — what the APIs actually return)
// ---------------------------------------------------------------------------

/** Shape of one SIGMET/AIRMET entry from the AWC GeoJSON API. */
export interface RawAwcFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry?: {
    type: string;
    coordinates?: unknown;
  } | null;
}

export interface RawAwcCollection {
  type: 'FeatureCollection';
  features: RawAwcFeature[];
}

/** Shape of one TFR entry from the FAA GeoJSON feed. */
export interface RawFaaTfrFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry?: {
    type: string;
    coordinates?: unknown;
  } | null;
}

export interface RawFaaTfrCollection {
  type: 'FeatureCollection';
  features: RawFaaTfrFeature[];
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Parse an ISO-8601 or AWC-format date string into a Date, returning epoch 0
 *  on failure rather than throwing. */
export function parseDateSafe(value: unknown): Date {
  if (!value) return new Date(0);
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? new Date(0) : d;
}

/** Convert an AWC "polygon" coordinates array [[lon, lat], …] to LatLon[]. */
export function awcCoordsToLatLon(coords: unknown): LatLon[] {
  if (!Array.isArray(coords)) return [];
  const converted: LatLon[] = [];
  for (const coordinate of coords as unknown[][]) {
    const [lon, lat] = coordinate;
    if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
        typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      return [];
    }
    converted.push({ lat, lon });
  }
  return converted;
}

/** Derive severity from kind + subType. */
export function deriveSeverity(kind: HazardKind, subType: string): HazardSeverity {
  if (kind === 'SIGMET') {
    // Match 'CONVECTIVE' but NOT 'NON-CONVECTIVE'
    const upper = subType.toUpperCase();
    if (upper.includes('CONVECTIVE') && !upper.includes('NON-CONVECTIVE')) return 'warning';
    return 'watch';
  }
  if (kind === 'TFR') {
    const upper = subType.toUpperCase();
    if (upper.includes('SECURITY') || upper.includes('SFRA')) return 'emergency';
    return 'advisory';
  }
  // AIRMET
  return 'watch';
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i;

function normalizeInstant(value: Date | string, field: 'from' | 'to'): Date {
  if (typeof value === 'string' && !ISO_INSTANT.test(value)) {
    throw new HazardValidationError(`hazard-valid-${field}-invalid`, `valid ${field} must be a timezone-qualified ISO instant`);
  }
  const result = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(result.getTime())) {
    throw new HazardValidationError(`hazard-valid-${field}-invalid`, `valid ${field} must be a valid instant`);
  }
  return result;
}

function normalizeCoordinate(value: LatLon): LatLon {
  if (!value || !Number.isFinite(value.lat) || !Number.isFinite(value.lon) ||
      value.lat < -90 || value.lat > 90 || value.lon < -180 || value.lon > 180) {
    throw new HazardValidationError('hazard-coordinate-invalid', 'coordinates must be finite and bounded');
  }
  return { lat: value.lat, lon: value.lon };
}

function sameCoordinate(a: LatLon, b: LatLon): boolean {
  return a.lat === b.lat && a.lon === b.lon;
}

/** Validate and canonicalize a provider-neutral hazard record. */
export function normalizeHazardRecord(input: HazardRecordInput): Hazard {
  const id = String(input.id ?? '').trim().toUpperCase();
  if (!id) throw new HazardValidationError('hazard-id-required', 'hazard id is required');
  const kind = String(input.kind ?? '').trim().toUpperCase();
  if (!['SIGMET', 'AIRMET', 'TFR'].includes(kind)) {
    throw new HazardValidationError('hazard-kind-invalid', 'hazard kind is invalid');
  }
  const subType = String(input.subType ?? '').trim().toUpperCase();
  if (!subType) throw new HazardValidationError('hazard-subtype-required', 'hazard subtype is required');
  const summary = String(input.summary ?? '').trim();
  if (!summary) throw new HazardValidationError('hazard-summary-required', 'hazard summary is required');

  let geometry: HazardGeometry;
  if (input.geometry?.type === 'Point') {
    geometry = { type: 'Point', coordinate: normalizeCoordinate(input.geometry.coordinate) };
  } else if (input.geometry?.type === 'Polygon' && Array.isArray(input.geometry.coordinates)) {
    const coordinates = input.geometry.coordinates.map(normalizeCoordinate);
    if (coordinates.length > 1 && sameCoordinate(coordinates[0], coordinates[coordinates.length - 1])) {
      coordinates.pop();
    }
    const distinct = new Set(coordinates.map((point) => `${point.lat},${point.lon}`));
    if (coordinates.length < 3 || distinct.size < 3) {
      throw new HazardValidationError('hazard-polygon-invalid', 'polygon requires three distinct vertices');
    }
    geometry = { type: 'Polygon', coordinates };
  } else {
    throw new HazardValidationError('hazard-geometry-invalid', 'hazard geometry is invalid');
  }

  const floor = input.altitudeBandFt?.floor ?? null;
  const ceiling = input.altitudeBandFt?.ceiling ?? null;
  for (const value of [floor, ceiling]) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      throw new HazardValidationError('hazard-altitude-band-invalid', 'altitudes must be non-negative finite values');
    }
  }
  if (floor !== null && ceiling !== null && floor > ceiling) {
    throw new HazardValidationError('hazard-altitude-band-invalid', 'altitude band is inverted');
  }

  const validFrom = normalizeInstant(input.validFrom, 'from');
  const validTo = normalizeInstant(input.validTo, 'to');
  if (validFrom > validTo) {
    throw new HazardValidationError('hazard-effective-window-invalid', 'hazard effective window is inverted');
  }
  const canonicalKind = kind as HazardKind;
  return {
    id, kind: canonicalKind, subType, summary, geometry,
    altitudeBandFt: { floor, ceiling }, validFrom, validTo,
    severity: deriveSeverity(canonicalKind, subType),
    ...(input.rawText == null ? {} : { rawText: String(input.rawText).trim() }),
    ...(input.sourceUrl == null ? {} : { sourceUrl: String(input.sourceUrl).trim() }),
  };
}

/** Parse a raw AWC feature into a Hazard.  Returns null if required fields
 *  are missing or the feature has already expired. */
export function parseAwcFeature(
  feature: RawAwcFeature,
  kind: HazardKind,
  now: Date = new Date()
): Hazard | null {
  const p = feature.properties;

  // Required: some temporal bound
  const validFrom = parseDateSafe(p['validTimeFrom'] ?? p['issueTime'] ?? p['validTime']);
  const validTo = parseDateSafe(p['validTimeTo'] ?? p['expireTime'] ?? p['validTimeEnd']);

  if (validTo.getTime() === 0) return null; // can't determine expiry
  if (validTo <= now) return null; // already expired

  // Geometry
  let geometry: HazardGeometry;
  if (
    feature.geometry?.type === 'Polygon' &&
    Array.isArray((feature.geometry as { type: string; coordinates?: unknown[] }).coordinates?.[0])
  ) {
    geometry = {
      type: 'Polygon',
      coordinates: awcCoordsToLatLon(
        (feature.geometry as { type: string; coordinates: unknown[][] }).coordinates[0]
      ),
    };
  } else if (
    feature.geometry?.type === 'Point' &&
    Array.isArray((feature.geometry as { type: string; coordinates?: unknown }).coordinates)
  ) {
    const coords = (feature.geometry as { type: string; coordinates: number[] }).coordinates;
    if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return null;
    geometry = { type: 'Point', coordinate: { lat: coords[1], lon: coords[0] } };
  } else return null;

  // Altitude band
  const floor =
    p['altitudeLow1'] != null ? Number(p['altitudeLow1']) :
    p['base'] != null ? Number(p['base']) : null;
  const ceiling =
    p['altitudeHi1'] != null ? Number(p['altitudeHi1']) :
    p['top'] != null ? Number(p['top']) : null;

  // Sub-type
  const rawSub = String(p['hazard'] ?? p['subType'] ?? p['type'] ?? '').toUpperCase();
  const subType = rawSub || (kind === 'SIGMET' ? 'NON-CONVECTIVE' : kind === 'AIRMET' ? 'SIERRA' : 'OTHER');

  // ID
  const id = String(p['airSigmetId'] ?? p['seriesId'] ?? p['id'] ?? `${kind}-${validFrom.getTime()}`);

  // Summary
  const summary = String(p['rawAirSigmet'] ?? p['rawText'] ?? p['name'] ?? `${kind} ${subType}`).slice(0, 200);

  try { return normalizeHazardRecord({
    id,
    kind,
    subType,
    summary,
    geometry,
    altitudeBandFt: { floor, ceiling },
    validFrom,
    validTo,
    rawText: String(p['rawAirSigmet'] ?? p['rawText'] ?? ''),
    sourceUrl: undefined,
  }); } catch (error) {
    if (error instanceof HazardValidationError) return null;
    throw error;
  }
}

/** Parse a raw FAA TFR GeoJSON feature into a Hazard. Returns null if expired
 *  or missing required fields. */
export function parseFaaTfrFeature(
  feature: RawFaaTfrFeature,
  now: Date = new Date()
): Hazard | null {
  const p = feature.properties;

  const validFrom = parseDateSafe(p['startDate'] ?? p['validTimeFrom'] ?? p['createDate']);
  const validTo = parseDateSafe(p['endDate'] ?? p['validTimeTo'] ?? p['expireDate']);

  if (validTo.getTime() === 0) return null;
  if (validTo <= now) return null;

  let geometry: HazardGeometry;
  if (
    feature.geometry?.type === 'Polygon' &&
    Array.isArray((feature.geometry as { type: string; coordinates?: unknown[] }).coordinates?.[0])
  ) {
    geometry = {
      type: 'Polygon',
      coordinates: awcCoordsToLatLon(
        (feature.geometry as { type: string; coordinates: unknown[][] }).coordinates[0]
      ),
    };
  } else return null;

  const floor =
    p['minAlt'] != null ? Number(p['minAlt']) :
    p['altitudeLow'] != null ? Number(p['altitudeLow']) : 0;
  const ceiling =
    p['maxAlt'] != null ? Number(p['maxAlt']) :
    p['altitudeHigh'] != null ? Number(p['altitudeHigh']) : null;

  const rawSubType = String(p['subType'] ?? p['type'] ?? 'OTHER').toUpperCase();
  const id = String(p['notamNumber'] ?? p['coreNOTAMNumber'] ?? p['id'] ?? `TFR-${validFrom.getTime()}`);
  const summary = String(p['facilityDesignation'] ?? p['name'] ?? id).slice(0, 200);

  try { return normalizeHazardRecord({
    id,
    kind: 'TFR',
    subType: rawSubType,
    summary,
    geometry,
    altitudeBandFt: { floor, ceiling },
    validFrom,
    validTo,
    rawText: String(p['notamText'] ?? ''),
    sourceUrl: undefined,
  }); } catch (error) {
    if (error instanceof HazardValidationError) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Geometry intersection utilities
// ---------------------------------------------------------------------------

/** Ray-casting polygon point-in-polygon test (2-D, lat/lon treated as planar
 *  — sufficient for the scale of SIGMETs / AIRMETs / TFRs). */
const GEOMETRY_EPSILON = 1e-10;

function orientation(a: LatLon, b: LatLon, c: LatLon): number {
  return (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon);
}

function pointOnSegment(point: LatLon, start: LatLon, end: LatLon): boolean {
  if (Math.abs(orientation(start, end, point)) > GEOMETRY_EPSILON) return false;
  return point.lon >= Math.min(start.lon, end.lon) - GEOMETRY_EPSILON &&
    point.lon <= Math.max(start.lon, end.lon) + GEOMETRY_EPSILON &&
    point.lat >= Math.min(start.lat, end.lat) - GEOMETRY_EPSILON &&
    point.lat <= Math.max(start.lat, end.lat) + GEOMETRY_EPSILON;
}

function segmentsIntersect(a: LatLon, b: LatLon, c: LatLon, d: LatLon): boolean {
  if (pointOnSegment(a, c, d) || pointOnSegment(b, c, d) ||
      pointOnSegment(c, a, b) || pointOnSegment(d, a, b)) return true;
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

export function pointInPolygon(point: LatLon, polygon: LatLon[]): boolean {
  for (let i = 0; i < polygon.length; i++) {
    if (pointOnSegment(point, polygon[i], polygon[(i + 1) % polygon.length])) return true;
  }
  const { lat, lon } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon;
    const yi = polygon[i].lat;
    const xj = polygon[j].lon;
    const yj = polygon[j].lat;
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Check whether a hazard's altitude band overlaps with a given altitude range.
 *  null floor is treated as 0 MSL; null ceiling is treated as FL600 (60 000 ft). */
export function altitudeOverlaps(
  hazard: Hazard,
  routeFloorFt: number,
  routeCeilingFt: number
): boolean {
  if (!Number.isFinite(routeFloorFt) || !Number.isFinite(routeCeilingFt) ||
      routeFloorFt > routeCeilingFt) return false;
  const hFloor = hazard.altitudeBandFt.floor ?? 0;
  const hCeiling = hazard.altitudeBandFt.ceiling ?? 60_000;
  // Ranges overlap when neither is entirely above/below the other
  return hFloor <= routeCeilingFt && hCeiling >= routeFloorFt;
}

/** Check whether a hazard intersects a route leg defined by two points. */
export function hazardIntersectsLeg(
  hazard: Hazard,
  legStart: LatLon,
  legEnd: LatLon,
  routeFloorFt: number,
  routeCeilingFt: number,
  at: Date = new Date()
): boolean {
  if (!altitudeOverlaps(hazard, routeFloorFt, routeCeilingFt)) return false;
  if (!isHazardActive(hazard, at)) return false;

  if (hazard.geometry.type === 'Point') {
    return pointOnSegment(hazard.geometry.coordinate, legStart, legEnd);
  }

  const poly = hazard.geometry.coordinates;
  if (pointInPolygon(legStart, poly) || pointInPolygon(legEnd, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    if (segmentsIntersect(legStart, legEnd, poly[i], poly[(i + 1) % poly.length])) return true;
  }
  return false;
}

/** Return true if the hazard is currently active. */
export function isHazardActive(hazard: Hazard, at: Date = new Date()): boolean {
  return at >= hazard.validFrom && at <= hazard.validTo;
}

/** Filter a list of hazards to those that are currently active. */
export function filterActiveHazards(hazards: Hazard[], at: Date = new Date()): Hazard[] {
  return hazards.filter((h) => isHazardActive(h, at));
}

// ---------------------------------------------------------------------------
// Route intersection
// ---------------------------------------------------------------------------

export interface RouteHazardResult {
  hazard: Hazard;
  /** Index of the route waypoint that starts the intersecting leg. */
  legStartIndex: number;
}

/** Find all active hazards that intersect any leg of a route.
 *  @param waypoints  Ordered list of lat/lon waypoints.
 *  @param cruiseAltFt  Planned cruise altitude in feet MSL.
 *  @param hazards  List of candidate hazards (active or not; filtered here).
 */
export function findRouteHazards(
  waypoints: LatLon[],
  cruiseAltFt: number,
  hazards: Hazard[],
  at: Date = new Date()
): RouteHazardResult[] {
  return findRouteHazardsInBand(
    waypoints, cruiseAltFt - 500, cruiseAltFt + 500, hazards, at
  );
}

/** Find all active route hazards using an explicit inclusive altitude band. */
export function findRouteHazardsInBand(
  waypoints: LatLon[],
  routeFloorFt: number,
  routeCeilingFt: number,
  hazards: Hazard[],
  at: Date = new Date()
): RouteHazardResult[] {
  const results: RouteHazardResult[] = [];
  const active = filterActiveHazards(hazards, at);

  for (let i = 0; i < waypoints.length - 1; i++) {
    const legStart = waypoints[i];
    const legEnd = waypoints[i + 1];
    for (const hazard of active) {
      if (hazardIntersectsLeg(hazard, legStart, legEnd, routeFloorFt, routeCeilingFt, at)) {
        results.push({ hazard, legStartIndex: i });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

export class HazardClient {
  private awcBaseUrl: string;
  private faaBaseUrl: string;
  private fetchFn: typeof fetch;

  constructor(opts: HazardClientOptions = {}) {
    this.awcBaseUrl = opts.awcBaseUrl ?? 'https://aviationweather.gov/api/data';
    this.faaBaseUrl = opts.faaBaseUrl ?? 'https://tfr.faa.gov';
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  /** Fetch all active SIGMETs from aviationweather.gov. */
  async fetchSigmets(now: Date = new Date()): Promise<Hazard[]> {
    const url = `${this.awcBaseUrl}/airsigmet?format=geojson&type=sigmet`;
    const res = await this.fetchFn(url);
    if (!res.ok) throw new Error(`SIGMET fetch failed: ${res.status}`);
    const data = (await res.json()) as RawAwcCollection;
    return (data.features ?? [])
      .map((f) => parseAwcFeature(f, 'SIGMET', now))
      .filter((h): h is Hazard => h !== null);
  }

  /** Fetch all active AIRMETs from aviationweather.gov. */
  async fetchAirmets(now: Date = new Date()): Promise<Hazard[]> {
    const url = `${this.awcBaseUrl}/airsigmet?format=geojson&type=airmet`;
    const res = await this.fetchFn(url);
    if (!res.ok) throw new Error(`AIRMET fetch failed: ${res.status}`);
    const data = (await res.json()) as RawAwcCollection;
    return (data.features ?? [])
      .map((f) => parseAwcFeature(f, 'AIRMET', now))
      .filter((h): h is Hazard => h !== null);
  }

  /** Fetch all active TFRs from the FAA GeoJSON feed. */
  async fetchTfrs(now: Date = new Date()): Promise<Hazard[]> {
    const url = `${this.faaBaseUrl}/tfr2/list.jsp?format=geojson`;
    const res = await this.fetchFn(url);
    if (!res.ok) throw new Error(`TFR fetch failed: ${res.status}`);
    const data = (await res.json()) as RawFaaTfrCollection;
    return (data.features ?? [])
      .map((f) => parseFaaTfrFeature(f, now))
      .filter((h): h is Hazard => h !== null);
  }

  /** Fetch all three hazard types and merge into one list. */
  async fetchAll(now: Date = new Date()): Promise<Hazard[]> {
    const [sigmets, airmets, tfrs] = await Promise.all([
      this.fetchSigmets(now),
      this.fetchAirmets(now),
      this.fetchTfrs(now),
    ]);
    return [...sigmets, ...airmets, ...tfrs];
  }
}
