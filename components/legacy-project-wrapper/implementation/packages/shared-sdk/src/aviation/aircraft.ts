export interface AirspeedOperatingLimits {
  /** Stall speed in the landing configuration, knots indicated airspeed. */
  vsoKias: number;
  /** Stall speed in a clean configuration, knots indicated airspeed. */
  vsKias: number;
  /** Maximum flap-extended speed, knots indicated airspeed. */
  vfeKias: number;
  /** Design maneuvering speed at the profile's declared condition, KIAS. */
  vaKias: number;
  /** Maximum structural cruising speed, knots indicated airspeed. */
  vnoKias: number;
  /** Never-exceed speed, knots indicated airspeed. */
  vneKias: number;
}

export interface AircraftFuelLimits {
  /** Total fuel-system capacity, including unusable fuel, U.S. gallons. */
  totalCapacityGal: number;
  /** Fuel available for flight in all approved conditions, U.S. gallons. */
  usableCapacityGal: number;
}

export interface AircraftWeightLimits {
  /** Maximum approved takeoff weight, pounds. */
  maximumTakeoffWeightLb: number;
}

export interface AircraftDimensions {
  lengthFt: number;
  heightFt: number;
  wingspanFt: number;
}

/**
 * Manufacturer-published reference figures. They are not an aircraft-specific
 * performance calculation or a substitute for the approved flight manual.
 */
export interface AircraftReferencePerformance {
  maximumCruiseSpeedKtas: number;
  maximumClimbRateFpm: number;
  serviceCeilingFt: number;
  /** Sea-level, standard-condition takeoff ground roll. */
  takeoffGroundRollFt: number;
  /** Sea-level, standard-condition takeoff distance over a 50-foot obstacle. */
  takeoffDistanceFt: number;
  /** Sea-level, standard-condition landing ground roll. */
  landingGroundRollFt: number;
  /** Sea-level, standard-condition landing distance over a 50-foot obstacle. */
  landingDistanceFt: number;
}

export interface AircraftOperatingProfile {
  profileId: string;
  icaoTypeDesignator: string;
  manufacturer: string;
  model: string;
  displayName: string;
  airspeedLimits: Readonly<AirspeedOperatingLimits>;
  fuelLimits: Readonly<AircraftFuelLimits>;
  weightLimits: Readonly<AircraftWeightLimits>;
  dimensions: Readonly<AircraftDimensions>;
  referencePerformance: Readonly<AircraftReferencePerformance>;
}

const requireText = (name: string, value: string): void => {
  if (value.trim().length === 0) {
    throw new TypeError(`${name} must be provided`);
  }
};

const requireIcaoTypeDesignator = (value: string): void => {
  if (!/^[A-Z0-9]{2,4}$/.test(value)) {
    throw new TypeError('icaoTypeDesignator must be 2-4 uppercase alphanumeric characters');
  }
};

const requirePositiveFinite = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be positive and finite`);
  }
};

const freezeRecord = <T extends object>(value: T): Readonly<T> => Object.freeze({ ...value });

export function createAircraftOperatingProfile(
  input: AircraftOperatingProfile
): Readonly<AircraftOperatingProfile> {
  requireText('profileId', input.profileId);
  requireIcaoTypeDesignator(input.icaoTypeDesignator);
  requireText('manufacturer', input.manufacturer);
  requireText('model', input.model);
  requireText('displayName', input.displayName);

  const airspeedLimits = freezeRecord(input.airspeedLimits);
  for (const [name, value] of Object.entries(airspeedLimits)) {
    requirePositiveFinite(name, value);
  }
  if (airspeedLimits.vsoKias > airspeedLimits.vsKias) {
    throw new RangeError('vsoKias must be less than or equal to vsKias');
  }
  if (airspeedLimits.vsKias >= airspeedLimits.vaKias) {
    throw new RangeError('vsKias must be less than vaKias');
  }
  if (airspeedLimits.vaKias > airspeedLimits.vnoKias) {
    throw new RangeError('vaKias must be less than or equal to vnoKias');
  }
  if (airspeedLimits.vnoKias >= airspeedLimits.vneKias) {
    throw new RangeError('vnoKias must be less than vneKias');
  }
  if (
    airspeedLimits.vfeKias <= airspeedLimits.vsoKias
    || airspeedLimits.vfeKias >= airspeedLimits.vneKias
  ) {
    throw new RangeError('vfeKias must fall between vsoKias and vneKias');
  }

  const fuelLimits = freezeRecord(input.fuelLimits);
  requirePositiveFinite('totalCapacityGal', fuelLimits.totalCapacityGal);
  requirePositiveFinite('usableCapacityGal', fuelLimits.usableCapacityGal);
  if (fuelLimits.usableCapacityGal > fuelLimits.totalCapacityGal) {
    throw new RangeError('usableCapacityGal must not exceed totalCapacityGal');
  }

  const weightLimits = freezeRecord(input.weightLimits);
  requirePositiveFinite(
    'maximumTakeoffWeightLb',
    weightLimits.maximumTakeoffWeightLb,
  );

  const dimensions = freezeRecord(input.dimensions);
  for (const [name, value] of Object.entries(dimensions)) {
    requirePositiveFinite(name, value);
  }

  const referencePerformance = freezeRecord(input.referencePerformance);
  for (const [name, value] of Object.entries(referencePerformance)) {
    requirePositiveFinite(name, value);
  }

  return Object.freeze({
    ...input,
    icaoTypeDesignator: input.icaoTypeDesignator.toUpperCase(),
    airspeedLimits,
    fuelLimits,
    weightLimits,
    dimensions,
    referencePerformance,
  });
}

export const C172S_OPERATING_PROFILE = createAircraftOperatingProfile({
  profileId: 'cessna-172s',
  icaoTypeDesignator: 'C172',
  manufacturer: 'Cessna',
  model: '172S',
  displayName: 'Cessna 172S Skyhawk',
  airspeedLimits: {
    vsoKias: 40,
    vsKias: 48,
    vfeKias: 85,
    vaKias: 105,
    vnoKias: 129,
    vneKias: 163,
  },
  fuelLimits: {
    totalCapacityGal: 56,
    usableCapacityGal: 53,
  },
  weightLimits: {
    maximumTakeoffWeightLb: 2550,
  },
  dimensions: {
    lengthFt: 27.1666666667,
    heightFt: 8.9166666667,
    wingspanFt: 36.0833333333,
  },
  referencePerformance: {
    maximumCruiseSpeedKtas: 124,
    maximumClimbRateFpm: 730,
    serviceCeilingFt: 14000,
    takeoffGroundRollFt: 960,
    takeoffDistanceFt: 1630,
    landingGroundRollFt: 575,
    landingDistanceFt: 1335,
  },
});

export const C182T_OPERATING_PROFILE = createAircraftOperatingProfile({
  profileId: 'cessna-182t',
  icaoTypeDesignator: 'C182',
  manufacturer: 'Cessna',
  model: '182T',
  displayName: 'Cessna 182T Skylane',
  airspeedLimits: {
    vsoKias: 41,
    vsKias: 51,
    vfeKias: 100,
    vaKias: 110,
    vnoKias: 140,
    vneKias: 175,
  },
  fuelLimits: {
    totalCapacityGal: 92,
    usableCapacityGal: 87,
  },
  weightLimits: {
    maximumTakeoffWeightLb: 3100,
  },
  dimensions: {
    lengthFt: 29,
    heightFt: 9.3333333333,
    wingspanFt: 36,
  },
  referencePerformance: {
    maximumCruiseSpeedKtas: 145,
    maximumClimbRateFpm: 924,
    serviceCeilingFt: 18100,
    takeoffGroundRollFt: 795,
    takeoffDistanceFt: 1514,
    landingGroundRollFt: 590,
    landingDistanceFt: 1350,
  },
});

export const SR22_PERSPECTIVE_3600_OPERATING_PROFILE = createAircraftOperatingProfile({
  profileId: 'cirrus-sr22-perspective-3600',
  icaoTypeDesignator: 'SR22',
  manufacturer: 'Cirrus Aircraft',
  model: 'SR22 Perspective 3600 lb',
  displayName: 'Cirrus SR22 Perspective',
  airspeedLimits: {
    vsoKias: 64,
    vsKias: 74,
    vfeKias: 110,
    vaKias: 140,
    vnoKias: 176,
    vneKias: 205,
  },
  fuelLimits: {
    totalCapacityGal: 94.5,
    usableCapacityGal: 92,
  },
  weightLimits: {
    maximumTakeoffWeightLb: 3600,
  },
  dimensions: {
    lengthFt: 26,
    heightFt: 8.9166666667,
    wingspanFt: 38.3333333333,
  },
  referencePerformance: {
    maximumCruiseSpeedKtas: 183,
    maximumClimbRateFpm: 1270,
    serviceCeilingFt: 17500,
    takeoffGroundRollFt: 1082,
    takeoffDistanceFt: 1868,
    landingGroundRollFt: 1178,
    landingDistanceFt: 2535,
  },
});

const OPERATING_PROFILES = Object.freeze([
  C172S_OPERATING_PROFILE,
  C182T_OPERATING_PROFILE,
  SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
]);

const normalizeIdentityPart = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');

/**
 * Resolve a bundled profile by stable profile ID or ICAO aircraft type
 * designator. ICAO lookup is case-insensitive.
 */
export function findAircraftOperatingProfile(
  identifier: string
): Readonly<AircraftOperatingProfile> | undefined {
  const query = identifier.trim();
  const designator = query.toUpperCase();
  return OPERATING_PROFILES.find(
    (profile) =>
      profile.profileId === query || profile.icaoTypeDesignator === designator,
  );
}

/**
 * Match a bundled profile to an application's manufacturer/model identity.
 * Both fields must match after case and whitespace normalization; partial or
 * model-only matches deliberately fail closed.
 */
export function matchAircraftOperatingProfile(
  manufacturer: string,
  model: string
): Readonly<AircraftOperatingProfile> | undefined {
  const normalizedManufacturer = normalizeIdentityPart(manufacturer);
  const normalizedModel = normalizeIdentityPart(model);
  if (!normalizedManufacturer || !normalizedModel) return undefined;
  return OPERATING_PROFILES.find(
    (profile) =>
      normalizeIdentityPart(profile.manufacturer) === normalizedManufacturer
      && normalizeIdentityPart(profile.model) === normalizedModel,
  );
}
