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
  takeoffDistanceFt: number;
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
    takeoffDistanceFt: 1630,
    landingDistanceFt: 1335,
  },
});

const OPERATING_PROFILES = Object.freeze([C172S_OPERATING_PROFILE]);

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
