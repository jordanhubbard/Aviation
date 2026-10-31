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
const TYPE_DESIGNATOR_ROWS = `C150|Cessna|150|Light Single-Engine
C152|Cessna|152|Light Single-Engine
C162|Cessna|162 Skycatcher|Light Single-Engine
C172|Cessna|172 Skyhawk|Light Single-Engine
C175|Cessna|175|Light Single-Engine
C177|Cessna|177 Cardinal|Light Single-Engine
C180|Cessna|180|Light Single-Engine
C182|Cessna|182 Skylane|Light Single-Engine
C185|Cessna|185|Light Single-Engine
C206|Cessna|206|Light Single-Engine
C207|Cessna|207|Light Single-Engine
C208|Cessna|208 Caravan|Light Turboprop
C210|Cessna|210 Centurion|Light Single-Engine
C310|Cessna|310|Light Twin-Engine
C337|Cessna|337 Skymaster|Light Twin-Engine
C340|Cessna|340|Light Twin-Engine
C402|Cessna|402|Light Twin-Engine
C414|Cessna|414|Light Twin-Engine
C421|Cessna|421|Light Twin-Engine
C441|Cessna|441 Conquest|Light Turboprop
C500|Cessna|Citation I|Light Jet
C525|Cessna|CitationJet|Light Jet
C550|Cessna|Citation II|Light Jet
C560|Cessna|Citation V|Light Jet
C650|Cessna|Citation III|Mid-Size Jet
C680|Cessna|Citation Sovereign|Mid-Size Jet
C750|Cessna|Citation X|Large Jet
PA18|Piper|J-3 Cub|Light Single-Engine
PA20|Piper|Pacer|Light Single-Engine
PA22|Piper|Tri-Pacer|Light Single-Engine
PA24|Piper|Comanche|Light Single-Engine
PA25|Piper|Pawnee|Agricultural
PA28|Piper|Cherokee/Warrior/Archer|Light Single-Engine
PA30|Piper|Twin Comanche|Light Twin-Engine
PA31|Piper|Navajo|Light Twin-Engine
PA32|Piper|Cherokee Six/Saratoga|Light Single-Engine
PA34|Piper|Seneca|Light Twin-Engine
PA36|Piper|Pawnee Brave|Agricultural
PA38|Piper|Tomahawk|Light Single-Engine
PA44|Piper|Seminole|Light Twin-Engine
PA46|Piper|Malibu/Mirage/Matrix|Light Single-Engine
B190|Beechcraft|King Air 100|Light Turboprop
B200|Beechcraft|King Air 200|Light Turboprop
B300|Beechcraft|King Air 350|Light Turboprop
BE20|Beechcraft|King Air|Light Turboprop
BE23|Beechcraft|Musketeer/Sundowner|Light Single-Engine
BE24|Beechcraft|Sierra|Light Single-Engine
BE33|Beechcraft|Debonair/Bonanza|Light Single-Engine
BE35|Beechcraft|Bonanza|Light Single-Engine
BE36|Beechcraft|Bonanza A36|Light Single-Engine
BE40|Beechcraft|Beechjet 400|Light Jet
BE55|Beechcraft|Baron|Light Twin-Engine
BE58|Beechcraft|Baron|Light Twin-Engine
BE76|Beechcraft|Duchess|Light Twin-Engine
BE77|Beechcraft|Skipper|Light Single-Engine
BE9L|Beechcraft|King Air 90|Light Turboprop
BE9T|Beechcraft|King Air 90|Light Turboprop
SR20|Cirrus|SR20|Light Single-Engine
SR22|Cirrus|SR22|Light Single-Engine
SF50|Cirrus|Vision Jet|Light Jet
DA20|Diamond|Katana|Light Single-Engine
DA40|Diamond|Diamond Star|Light Single-Engine
DA42|Diamond|Twin Star|Light Twin-Engine
DA62|Diamond|DA62|Light Twin-Engine
CH7A|American Champion|7ECA Citabria|Aerobatic
CH7B|American Champion|7GCAA Citabria|Aerobatic
CH7C|American Champion|7GCBC Citabria|Aerobatic
CH7E|American Champion|7ECA Citabria|Aerobatic
CH7G|American Champion|7GCAA Citabria|Aerobatic
CH7K|American Champion|7KCAB Citabria|Aerobatic
CH8A|American Champion|8KCAB Decathlon|Aerobatic
CH8G|American Champion|8GCBC Scout|Light Single-Engine
BL8|American Champion|8KCAB Decathlon|Aerobatic
M20C|Mooney|M20C Ranger|Light Single-Engine
M20E|Mooney|M20E Super 21|Light Single-Engine
M20F|Mooney|M20F Executive 21|Light Single-Engine
M20J|Mooney|M20J 201|Light Single-Engine
M20K|Mooney|M20K 231|Light Single-Engine
M20M|Mooney|M20M TLS|Light Single-Engine
M20R|Mooney|M20R Ovation|Light Single-Engine
M20S|Mooney|M20S Eagle|Light Single-Engine
M20T|Mooney|M20T Acclaim|Light Single-Engine
AA1|Grumman|AA-1 Yankee|Light Single-Engine
AA1A|Grumman|AA-1A Trainer|Light Single-Engine
AA1B|Grumman|AA-1B Trainer|Light Single-Engine
AA1C|Grumman|AA-1C Lynx|Light Single-Engine
AA5A|Grumman|AA-5A Cheetah|Light Single-Engine
AA5B|Grumman|AA-5B Tiger|Light Single-Engine
AG5B|American General|AG-5B Tiger|Light Single-Engine
RV3|Van's|RV-3|Experimental
RV4|Van's|RV-4|Experimental
RV6|Van's|RV-6|Experimental
RV7|Van's|RV-7|Experimental
RV8|Van's|RV-8|Experimental
RV9|Van's|RV-9|Experimental
RV10|Van's|RV-10|Experimental
RV12|Van's|RV-12|Light Sport
RV14|Van's|RV-14|Experimental
M4|Maule|M-4|Light Single-Engine
M5|Maule|M-5|Light Single-Engine
M6|Maule|M-6|Light Single-Engine
M7|Maule|M-7|Light Single-Engine
M8|Maule|M-8|Light Single-Engine
M9|Maule|M-9|Light Single-Engine
TBM7|Socata|TBM 700|Light Turboprop
TBM8|Socata|TBM 800|Light Turboprop
TBM9|Daher|TBM 900|Light Turboprop
TB10|Socata|TB 10 Tobago|Light Single-Engine
TB20|Socata|TB 20 Trinidad|Light Single-Engine
TB21|Socata|TB 21 Trinidad TC|Light Single-Engine
EA30|Extra|EA-300|Aerobatic
EA32|Extra|EA-330|Aerobatic
PTS1|Pitts|S-1 Special|Aerobatic
PTS2|Pitts|S-2 Special|Aerobatic
ASK13|Alexander Schleicher|ASK 13|Glider
ASK21|Alexander Schleicher|ASK 21|Glider
K21|Alexander Schleicher|ASK 21|Glider
SGS233|Schweizer|SGS 2-33|Glider
SGS126|Schweizer|SGS 1-26|Glider
CTLS|Flight Design|CT-LS|Light Sport
FK9|FK Lightplanes|FK9|Light Sport
RANS|RANS|S-6ES Coyote II|Light Sport
BT-13|Vultee|BT-13 Valiant|Vintage Trainer
BT13|Vultee|BT-13 Valiant|Vintage Trainer
T6|North American/Beechcraft|T-6 Texan/Harvard|Military Trainer
T-6|North American/Beechcraft|T-6 Texan/Harvard|Military Trainer
AT6|North American|AT-6 Texan|Military Trainer
R22|Robinson|R22|Helicopter
R44|Robinson|R44|Helicopter
R66|Robinson|R66|Helicopter
H269|Hughes/Schweizer|269/300|Helicopter
S300|Schweizer|S-300|Helicopter
B737|Boeing|737|Commercial Jet
B738|Boeing|737-800|Commercial Jet
B739|Boeing|737-900|Commercial Jet
B752|Boeing|757-200|Commercial Jet
B763|Boeing|767-300|Commercial Jet
B772|Boeing|777-200|Commercial Jet
B773|Boeing|777-300|Commercial Jet
B787|Boeing|787 Dreamliner|Commercial Jet
A319|Airbus|A319|Commercial Jet
A320|Airbus|A320|Commercial Jet
A321|Airbus|A321|Commercial Jet
A330|Airbus|A330|Commercial Jet
A350|Airbus|A350|Commercial Jet
E145|Embraer|ERJ 145|Regional Jet
E170|Embraer|E-Jet 170|Regional Jet
E175|Embraer|E-Jet 175|Regional Jet
CRJ2|Bombardier|CRJ-200|Regional Jet
CRJ7|Bombardier|CRJ-700|Regional Jet
CRJ9|Bombardier|CRJ-900|Regional Jet
DH8A|De Havilland|Dash 8-100|Regional Turboprop
DH8B|De Havilland|Dash 8-200|Regional Turboprop
DH8C|De Havilland|Dash 8-300|Regional Turboprop
DH8D|De Havilland|Dash 8-400|Regional Turboprop
AT72|ATR|ATR 72|Regional Turboprop
AT42|ATR|ATR 42|Regional Turboprop`;

const ADDITIONAL_TYPE_DESIGNATORS = Object.freeze([
  'A10', 'AN2', 'C130', 'DHC2', 'DHC3', 'DHC6', 'F16',
  'F18', 'KC135', 'L39', 'P51', 'T28', 'T34',
]);


/** A qualified record in the SDK's bundled aircraft type-designator snapshot. */
export interface AircraftTypeDesignatorRecord {
  code: string;
  manufacturer: string;
  model: string;
  category: string;
}

export interface AircraftTypeDesignatorCatalogSummary {
  totalCodes: number;
  detailedCodes: number;
  additionalCodes: number;
  categories: Readonly<Record<string, number>>;
  manufacturersCount: number;
}

export const AIRCRAFT_TYPE_DESIGNATOR_SEARCH_URL =
  'https://www.icao.int/operational-safety/doc-8643-aircraft-type-designators/search';

export const AIRCRAFT_TYPE_DESIGNATORS: Readonly<
  Record<string, Readonly<AircraftTypeDesignatorRecord>>
> = Object.freeze(Object.fromEntries(
  TYPE_DESIGNATOR_ROWS.split('\n').map((row) => {
    const [code, manufacturer, model, category] = row.split('|');
    return [code, Object.freeze({ code, manufacturer, model, category })];
  }),
));

export const ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS: readonly string[] =
  ADDITIONAL_TYPE_DESIGNATORS;

const SUPPORTED_TYPE_DESIGNATORS = new Set([
  ...Object.keys(AIRCRAFT_TYPE_DESIGNATORS),
  ...ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS,
]);

const normalizeTypeDesignator = (code: string): string => code.trim().toUpperCase();

/**
 * Whether a designator appears in the SDK's qualified snapshot. This is not a
 * claim that the snapshot is a complete or current substitute for ICAO Doc 8643.
 */
export function isSupportedAircraftTypeDesignator(code: string): boolean {
  return SUPPORTED_TYPE_DESIGNATORS.has(normalizeTypeDesignator(code));
}

/** Return detailed bundled metadata, or undefined for unknown/additional-only codes. */
export function findAircraftTypeDesignator(
  code: string,
): Readonly<AircraftTypeDesignatorRecord> | undefined {
  return AIRCRAFT_TYPE_DESIGNATORS[normalizeTypeDesignator(code)];
}

/** Deterministic suggestions, prioritizing exact two-character prefixes. */
export function suggestAircraftTypeDesignators(
  code: string,
  maximum = 5,
): string[] {
  const query = normalizeTypeDesignator(code);
  if (!query || maximum <= 0) return [];
  const candidates = [...SUPPORTED_TYPE_DESIGNATORS].sort();
  const prefix = query.length >= 2
    ? candidates.filter((candidate) => candidate.startsWith(query.slice(0, 2)))
    : [];
  const prefixSet = new Set(prefix);
  const queryCharacters = new Set(query);
  const fuzzy = candidates.filter((candidate) => {
    if (prefixSet.has(candidate) || Math.abs(candidate.length - query.length) > 1) {
      return false;
    }
    const common = [...queryCharacters].filter((character) => candidate.includes(character));
    return common.length >= Math.floor(query.length / 2);
  });
  return [...prefix, ...fuzzy].slice(0, maximum);
}

export function aircraftTypeDesignatorsByManufacturer(manufacturer: string): string[] {
  const query = manufacturer.trim().toLocaleLowerCase('en-US');
  if (!query) return [];
  return Object.values(AIRCRAFT_TYPE_DESIGNATORS)
    .filter((record) => record.manufacturer.toLocaleLowerCase('en-US') === query)
    .map((record) => record.code)
    .sort();
}

export function aircraftTypeDesignatorCatalogSummary(): AircraftTypeDesignatorCatalogSummary {
  const categories: Record<string, number> = {};
  const manufacturers = new Set<string>();
  for (const record of Object.values(AIRCRAFT_TYPE_DESIGNATORS)) {
    categories[record.category] = (categories[record.category] ?? 0) + 1;
    manufacturers.add(record.manufacturer);
  }
  return {
    totalCodes: SUPPORTED_TYPE_DESIGNATORS.size,
    detailedCodes: Object.keys(AIRCRAFT_TYPE_DESIGNATORS).length,
    additionalCodes: ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS.length,
    categories: Object.freeze(Object.fromEntries(Object.entries(categories).sort())),
    manufacturersCount: manufacturers.size,
  };
}

export function aircraftTypeDesignatorValidationMessage(code: string): string {
  const normalized = normalizeTypeDesignator(code);
  if (!normalized) return 'Missing ICAO aircraft type code';
  let message = `Invalid ICAO aircraft type code: '${normalized}'`;
  const suggestions = suggestAircraftTypeDesignators(normalized);
  if (suggestions.length > 0) message += `. Similar codes: ${suggestions.join(', ')}`;
  return `${message}. Verify in ICAO Doc 8643: ${AIRCRAFT_TYPE_DESIGNATOR_SEARCH_URL}`;
}
