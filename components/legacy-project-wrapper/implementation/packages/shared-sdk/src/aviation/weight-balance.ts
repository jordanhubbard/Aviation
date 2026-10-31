/**
 * Portable aircraft loading profiles and weight-and-balance calculations.
 *
 * @module @aviation/shared-sdk/aviation/weight-balance
 */

import {
  C172S_OPERATING_PROFILE,
  type AircraftOperatingProfile,
} from './aircraft.js';

export interface EnvelopePoint {
  weight: number;
  forward: number;
  aft: number;
}

export interface LoadingStationDefinition {
  stationId?: string;
  name: string;
  arm: number;
  maximumWeight?: number;
}

export interface QualifiedLoadingStationDefinition extends LoadingStationDefinition {
  stationId: string;
}

export interface LoadingStationGroupLimit {
  name: string;
  stationIds: ReadonlyArray<string>;
  maximumWeight: number;
}

/**
 * A reusable loading profile. Basic empty weight and moment are sample values
 * unless replaced with the current record for a particular aircraft.
 */
export interface LoadingProfile {
  profileId?: string;
  aircraftProfileId?: string;
  displayName?: string;
  emptyWeight: number;
  emptyMoment?: number;
  /** Compatibility input; qualified profiles use emptyMoment. */
  emptyArm?: number;
  maxGross: number;
  usableFuelCapacity?: number;
  fuelArm: number;
  fuelDensity: number;
  stations: ReadonlyArray<Readonly<LoadingStationDefinition>>;
  stationGroupLimits?: ReadonlyArray<Readonly<LoadingStationGroupLimit>>;
  envelope: ReadonlyArray<Readonly<EnvelopePoint>>;
}

export interface QualifiedLoadingProfile extends LoadingProfile {
  profileId: string;
  aircraftProfileId: string;
  displayName: string;
  emptyMoment: number;
  usableFuelCapacity: number;
  stations: ReadonlyArray<Readonly<QualifiedLoadingStationDefinition>>;
  stationGroupLimits: ReadonlyArray<Readonly<LoadingStationGroupLimit>>;
}

export interface LoadingInput {
  stationWeights: ReadonlyArray<number>;
  fuelGallons: number;
  fuelBurnGallons: number;
}

export interface LoadingCondition {
  weight: number;
  cg: number;
  limits: { forward: number; aft: number } | null;
  problems: string[];
  withinLimits: boolean;
}

export interface LoadingResult {
  takeoff: LoadingCondition;
  landing: LoadingCondition;
}

const requireText = (name: string, value: string): void => {
  if (!value.trim()) throw new TypeError(`${name} must be provided`);
};

const requirePositiveFinite = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be positive and finite`);
  }
};

/** Interpolate forward and aft CG limits for a weight inside an envelope. */
export function interpolateEnvelope(
  envelope: ReadonlyArray<EnvelopePoint>,
  weight: number
): { forward: number; aft: number } | null {
  if (!Number.isFinite(weight)) {
    throw new RangeError('Weight must be finite');
  }
  const rows = [...envelope].sort((a, b) => a.weight - b.weight);
  if (
    rows.length < 2 ||
    rows.some(
      row =>
        !Number.isFinite(row.weight) ||
        !Number.isFinite(row.forward) ||
        !Number.isFinite(row.aft) ||
        row.weight <= 0 ||
        row.forward <= 0 ||
        row.aft <= 0 ||
        row.forward > row.aft
    ) ||
    rows.some((row, index) => index > 0 && row.weight <= rows[index - 1].weight)
  ) {
    throw new RangeError('Envelope must contain at least two valid rows with distinct weights');
  }
  if (weight < rows[0].weight || weight > rows[rows.length - 1].weight) {
    return null;
  }
  for (let index = 0; index < rows.length - 1; index += 1) {
    const low = rows[index];
    const high = rows[index + 1];
    if (weight < low.weight || weight > high.weight) continue;
    const ratio = (weight - low.weight) / (high.weight - low.weight);
    return {
      forward: low.forward + ratio * (high.forward - low.forward),
      aft: low.aft + ratio * (high.aft - low.aft),
    };
  }
  return null;
}

/** Validate and freeze a portable loading profile. */
export function createLoadingProfile(
  input: QualifiedLoadingProfile,
  aircraft?: Readonly<AircraftOperatingProfile>
): Readonly<QualifiedLoadingProfile> {
  requireText('profileId', input.profileId);
  requireText('aircraftProfileId', input.aircraftProfileId);
  requireText('displayName', input.displayName);
  requirePositiveFinite('emptyWeight', input.emptyWeight);
  requirePositiveFinite('emptyMoment', input.emptyMoment);
  requirePositiveFinite('maxGross', input.maxGross);
  requirePositiveFinite('usableFuelCapacity', input.usableFuelCapacity);
  requirePositiveFinite('fuelArm', input.fuelArm);
  requirePositiveFinite('fuelDensity', input.fuelDensity);
  if (input.emptyWeight > input.maxGross) {
    throw new RangeError('emptyWeight must not exceed maxGross');
  }

  if (aircraft) {
    if (input.aircraftProfileId !== aircraft.profileId) {
      throw new RangeError('aircraftProfileId must match the linked aircraft profile');
    }
    if (input.maxGross !== aircraft.weightLimits.maximumTakeoffWeightLb) {
      throw new RangeError('maxGross must match the linked aircraft profile');
    }
    if (input.usableFuelCapacity !== aircraft.fuelLimits.usableCapacityGal) {
      throw new RangeError('usableFuelCapacity must match the linked aircraft profile');
    }
  }

  if (input.stations.length === 0) {
    throw new RangeError('stations must not be empty');
  }
  const stationIds = new Set<string>();
  const stations = input.stations.map(station => {
    requireText('stationId', station.stationId);
    requireText('station name', station.name);
    requirePositiveFinite(`${station.stationId}.arm`, station.arm);
    if (station.maximumWeight !== undefined) {
      requirePositiveFinite(`${station.stationId}.maximumWeight`, station.maximumWeight);
    }
    if (stationIds.has(station.stationId)) {
      throw new RangeError(`Duplicate stationId: ${station.stationId}`);
    }
    stationIds.add(station.stationId);
    return Object.freeze({ ...station });
  });

  const stationGroupLimits = input.stationGroupLimits.map(group => {
    requireText('station group name', group.name);
    requirePositiveFinite(`${group.name}.maximumWeight`, group.maximumWeight);
    if (group.stationIds.length === 0 || group.stationIds.some(id => !stationIds.has(id))) {
      throw new RangeError(`${group.name} must reference known stations`);
    }
    return Object.freeze({ ...group, stationIds: Object.freeze([...group.stationIds]) });
  });

  const envelope = input.envelope.map(point => Object.freeze({ ...point }));
  if (!interpolateEnvelope(envelope, input.emptyWeight)) {
    throw new RangeError('emptyWeight must be represented by the loading envelope');
  }

  return Object.freeze({
    ...input,
    stations: Object.freeze(stations),
    stationGroupLimits: Object.freeze(stationGroupLimits),
    envelope: Object.freeze(envelope),
  });
}

/** Calculate takeoff and after-burn landing weight, moment-derived CG, and limits. */
export function calculateLoad(
  profile: Readonly<LoadingProfile>,
  loading: LoadingInput
): LoadingResult {
  const emptyMoment =
    profile.emptyMoment ??
    (profile.emptyArm === undefined ? Number.NaN : profile.emptyWeight * profile.emptyArm);
  const values = [
    profile.emptyWeight,
    emptyMoment,
    profile.maxGross,
    profile.fuelArm,
    profile.fuelDensity,
    ...profile.stations.map(station => station.arm),
    loading.fuelGallons,
    loading.fuelBurnGallons,
    ...loading.stationWeights,
  ];
  if (
    values.some(value => !Number.isFinite(value)) ||
    profile.emptyWeight <= 0 ||
    profile.maxGross <= 0 ||
    profile.fuelDensity <= 0 ||
    loading.fuelGallons < 0 ||
    loading.fuelBurnGallons < 0 ||
    loading.fuelBurnGallons > loading.fuelGallons ||
    loading.stationWeights.some(weight => weight < 0) ||
    profile.stations.length !== loading.stationWeights.length
  ) {
    throw new RangeError(
      'Enter valid station and fuel values. Fuel burn cannot exceed fuel loaded.'
    );
  }

  const loadingProblems: string[] = [];
  profile.stations.forEach((station, index) => {
    if (
      station.maximumWeight !== undefined &&
      loading.stationWeights[index] > station.maximumWeight
    ) {
      loadingProblems.push(`${station.name} exceeds station limit`);
    }
  });
  const weightByStationId = new Map(
    profile.stations.map((station, index) => [
      station.stationId ?? String(index),
      loading.stationWeights[index],
    ])
  );
  (profile.stationGroupLimits ?? []).forEach(group => {
    const groupWeight = group.stationIds.reduce(
      (sum, stationId) => sum + (weightByStationId.get(stationId) ?? 0),
      0
    );
    if (groupWeight > group.maximumWeight) {
      loadingProblems.push(`${group.name} exceeds combined limit`);
    }
  });

  const baseWeight =
    profile.emptyWeight + loading.stationWeights.reduce((sum, weight) => sum + weight, 0);
  const baseMoment =
    emptyMoment +
    loading.stationWeights.reduce(
      (sum, weight, index) => sum + weight * profile.stations[index].arm,
      0
    );
  const condition = (gallons: number): LoadingCondition => {
    const weight = baseWeight + gallons * profile.fuelDensity;
    const cg = (baseMoment + gallons * profile.fuelDensity * profile.fuelArm) / weight;
    const limits = interpolateEnvelope(profile.envelope, weight);
    const problems = [...loadingProblems];
    if (
      profile.usableFuelCapacity !== undefined &&
      gallons > profile.usableFuelCapacity
    ) {
      problems.push('Fuel exceeds usable capacity');
    }
    if (weight > profile.maxGross) problems.push('Above maximum gross weight');
    if (!limits) problems.push('Weight outside entered CG envelope range');
    else if (cg < limits.forward || cg > limits.aft) {
      problems.push('CG outside entered limits');
    }
    return { weight, cg, limits, problems, withinLimits: problems.length === 0 };
  };
  return {
    takeoff: condition(loading.fuelGallons),
    landing: condition(loading.fuelGallons - loading.fuelBurnGallons),
  };
}

/**
 * C172S sample loading profile from the manufacturer handbook. Empty weight
 * and moment are the handbook sample, not data for a particular airframe.
 */
export const C172S_LOADING_PROFILE = createLoadingProfile(
  {
    profileId: 'cessna-172s-sample-loading',
    aircraftProfileId: C172S_OPERATING_PROFILE.profileId,
    displayName: 'Cessna 172S Skyhawk sample loading',
    emptyWeight: 1642,
    emptyMoment: 62600,
    maxGross: C172S_OPERATING_PROFILE.weightLimits.maximumTakeoffWeightLb,
    usableFuelCapacity: C172S_OPERATING_PROFILE.fuelLimits.usableCapacityGal,
    fuelArm: 48,
    fuelDensity: 6,
    stations: [
      { stationId: 'pilot', name: 'Pilot', arm: 37 },
      { stationId: 'copilot', name: 'Copilot', arm: 37 },
      { stationId: 'rear-passengers', name: 'Rear passengers', arm: 73 },
      { stationId: 'baggage-a', name: 'Baggage area A', arm: 95, maximumWeight: 120 },
      { stationId: 'baggage-b', name: 'Baggage area B', arm: 123, maximumWeight: 50 },
    ],
    stationGroupLimits: [
      {
        name: 'Baggage areas A and B',
        stationIds: ['baggage-a', 'baggage-b'],
        maximumWeight: 120,
      },
    ],
    envelope: [
      { weight: 1500, forward: 35, aft: 47.3 },
      { weight: 1950, forward: 35, aft: 47.3 },
      { weight: 2550, forward: 41, aft: 47.3 },
    ],
  },
  C172S_OPERATING_PROFILE
);

const LOADING_PROFILES = Object.freeze([C172S_LOADING_PROFILE]);

/** Resolve a bundled loading profile by profile ID or linked aircraft profile ID. */
export function findLoadingProfile(
  identifier: string
): Readonly<QualifiedLoadingProfile> | undefined {
  const query = identifier.trim();
  return LOADING_PROFILES.find(
    profile => profile.profileId === query || profile.aircraftProfileId === query
  );
}
