export type NavDataFreshness = 'current' | 'expired' | 'future' | 'undated';

export type NavDataMetadata = {
  source: string;
  cycle?: string | null;
  retrieved_at?: string | null;
  effective_from?: string | null;
  effective_through?: string | null;
};

export type NavaidRecord = {
  identifier: string;
  name?: string | null;
  type: string;
  latitude: number;
  longitude: number;
  frequency?: number | null;
  magnetic_variation?: number | null;
};

export type ProcedureLeg = {
  fix: string;
  path_type?: string | null;
  altitude_constraint?: string | null;
  speed_constraint?: string | null;
  altitude_ft?: number | null;
  course_deg?: number | null;
};

export type ProcedureRecord = {
  identifier: string;
  airport_icao: string;
  procedure_type: 'SID' | 'STAR' | 'APPROACH';
  runway?: string | null;
  initial_altitude_ft?: number | null;
  transitions: string[];
  legs: ProcedureLeg[];
};

export type GeoJsonFeature = {
  type: 'Feature';
  geometry: Record<string, unknown>;
  properties: Record<string, unknown>;
};

export type NavDataBundle = {
  metadata: NavDataMetadata;
  navaids: NavaidRecord[];
  procedures: ProcedureRecord[];
  airspace: { type: 'FeatureCollection'; features: GeoJsonFeature[] };
};

const canonical = (value: unknown, field: string): string => {
  const result = String(value ?? '').trim().toUpperCase();
  if (!result) throw new Error(`${field} is required`);
  return result;
};

const optionalCanonical = (value: unknown): string | null => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return String(value).trim().toUpperCase();
};

const optionalString = (value: unknown): string | null => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return String(value).trim();
};

const finiteNumber = (value: unknown, field: string): number => {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`${field} must be finite`);
  return result;
};

const optionalNumber = (value: unknown, field: string): number | null => {
  if (value === null || value === undefined || value === '') return null;
  return finiteNumber(value, field);
};

const parseInstant = (value: string, field: string): number => {
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) throw new Error(`${field} must be an ISO-8601 instant`);
  return instant;
};

export function normalizeMetadata(input: Record<string, unknown>): NavDataMetadata {
  const source = String(input.source ?? '').trim();
  if (!source) throw new Error('metadata.source is required');
  const metadata: NavDataMetadata = {
    source,
    cycle: optionalString(input.cycle),
    retrieved_at: optionalString(input.retrieved_at),
    effective_from: optionalString(input.effective_from),
    effective_through: optionalString(input.effective_through),
  };
  for (const field of ['retrieved_at', 'effective_from', 'effective_through'] as const) {
    const value = metadata[field];
    if (value) parseInstant(value, field);
  }
  if (
    metadata.effective_from
    && metadata.effective_through
    && parseInstant(metadata.effective_from, 'effective_from') > parseInstant(metadata.effective_through, 'effective_through')
  ) {
    throw new Error('effective_from must not follow effective_through');
  }
  return metadata;
}

export function freshnessStatus(
  metadataInput: Record<string, unknown> | NavDataMetadata,
  at: string | Date = new Date(),
): NavDataFreshness {
  const metadata = normalizeMetadata(metadataInput as Record<string, unknown>);
  const reference = at instanceof Date ? at.getTime() : parseInstant(at, 'at');
  if (!Number.isFinite(reference)) throw new Error('at must be a valid instant');
  if (metadata.effective_from && reference < parseInstant(metadata.effective_from, 'effective_from')) return 'future';
  if (metadata.effective_through && reference > parseInstant(metadata.effective_through, 'effective_through')) return 'expired';
  if (!metadata.effective_from && !metadata.effective_through) return 'undated';
  return 'current';
}

export function normalizeNavaid(input: Record<string, unknown>): NavaidRecord {
  const latitude = finiteNumber(input.latitude, 'latitude');
  const longitude = finiteNumber(input.longitude, 'longitude');
  if (latitude < -90 || latitude > 90) throw new Error('latitude must be in [-90, 90]');
  if (longitude < -180 || longitude > 180) throw new Error('longitude must be in [-180, 180]');
  const frequency = optionalNumber(input.frequency, 'frequency');
  if (frequency !== null && frequency <= 0) throw new Error('frequency must be positive');
  return {
    identifier: canonical(input.identifier, 'identifier'),
    name: optionalString(input.name),
    type: canonical(input.type, 'type'),
    latitude,
    longitude,
    frequency,
    magnetic_variation: optionalNumber(input.magnetic_variation, 'magnetic_variation'),
  };
}

export function normalizeProcedure(input: Record<string, unknown>): ProcedureRecord {
  const procedureType = canonical(input.procedure_type, 'procedure_type');
  if (!['SID', 'STAR', 'APPROACH'].includes(procedureType)) {
    throw new Error('procedure_type must be SID, STAR, or APPROACH');
  }
  const transitions = Array.isArray(input.transitions)
    ? input.transitions.map((value) => canonical(value, 'transition'))
    : [];
  const legs = Array.isArray(input.legs)
    ? input.legs.map((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('procedure leg must be an object');
      const leg = raw as Record<string, unknown>;
      return {
        fix: canonical(leg.fix, 'fix'),
        path_type: optionalCanonical(leg.path_type),
        altitude_constraint: optionalString(leg.altitude_constraint),
        speed_constraint: optionalString(leg.speed_constraint),
        altitude_ft: optionalNumber(leg.altitude_ft, 'altitude_ft'),
        course_deg: optionalNumber(leg.course_deg, 'course_deg'),
      } satisfies ProcedureLeg;
    })
    : [];
  return {
    identifier: canonical(input.identifier, 'identifier'),
    airport_icao: canonical(input.airport_icao, 'airport_icao'),
    procedure_type: procedureType as ProcedureRecord['procedure_type'],
    runway: optionalCanonical(input.runway),
    initial_altitude_ft: optionalNumber(input.initial_altitude_ft, 'initial_altitude_ft'),
    transitions,
    legs,
  };
}

export function normalizeAirspace(
  input: unknown,
): { type: 'FeatureCollection'; features: GeoJsonFeature[] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('airspace must be a GeoJSON FeatureCollection');
  }
  const collection = input as Record<string, unknown>;
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error('airspace must be a GeoJSON FeatureCollection');
  }
  const features = collection.features.filter((raw): raw is GeoJsonFeature => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const feature = raw as Record<string, unknown>;
    return feature.type === 'Feature'
      && !!feature.geometry
      && typeof feature.geometry === 'object'
      && !Array.isArray(feature.geometry)
      && !!feature.properties
      && typeof feature.properties === 'object'
      && !Array.isArray(feature.properties);
  });
  return { type: 'FeatureCollection', features };
}

export function normalizeNavDataBundle(input: Record<string, unknown>): NavDataBundle {
  if (!input.metadata || typeof input.metadata !== 'object' || Array.isArray(input.metadata)) {
    throw new Error('metadata is required');
  }
  return {
    metadata: normalizeMetadata(input.metadata as Record<string, unknown>),
    navaids: Array.isArray(input.navaids)
      ? input.navaids.map((value) => normalizeNavaid(value as Record<string, unknown>))
      : [],
    procedures: Array.isArray(input.procedures)
      ? input.procedures.map((value) => normalizeProcedure(value as Record<string, unknown>))
      : [],
    airspace: normalizeAirspace(input.airspace ?? { type: 'FeatureCollection', features: [] }),
  };
}

export class NavDataCatalog {
  readonly bundle: NavDataBundle;

  constructor(input: Record<string, unknown>) {
    this.bundle = normalizeNavDataBundle(input);
  }

  searchNavaids(query: string): NavaidRecord[] {
    const normalized = query.trim().toUpperCase();
    if (!normalized) return [];
    return this.bundle.navaids.filter((record) => (
      record.identifier.includes(normalized)
      || (record.name ?? '').toUpperCase().includes(normalized)
    ));
  }

  proceduresForAirport(
    airportIcao: string,
    procedureType?: string | null,
    runway?: string | null,
  ): ProcedureRecord[] {
    const airport = canonical(airportIcao, 'airport_icao');
    const type = optionalCanonical(procedureType);
    if (type && !['SID', 'STAR', 'APPROACH'].includes(type)) {
      throw new Error('procedure_type must be SID, STAR, or APPROACH');
    }
    const normalizedRunway = optionalCanonical(runway);
    return this.bundle.procedures.filter((record) => (
      record.airport_icao === airport
      && (!type || record.procedure_type === type)
      && (!normalizedRunway || record.runway === normalizedRunway)
    ));
  }

  status(at: string | Date = new Date()): Record<string, unknown> {
    return {
      navaid_count: this.bundle.navaids.length,
      procedure_count: this.bundle.procedures.length,
      airspace_count: this.bundle.airspace.features.length,
      source: this.bundle.metadata.source,
      cycle: this.bundle.metadata.cycle ?? null,
      effective_from: this.bundle.metadata.effective_from ?? null,
      effective_through: this.bundle.metadata.effective_through ?? null,
      freshness: freshnessStatus(this.bundle.metadata, at),
    };
  }
}
