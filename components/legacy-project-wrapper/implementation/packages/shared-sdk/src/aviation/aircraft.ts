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

export interface AircraftOperatingProfile {
  profileId: string;
  manufacturer: string;
  model: string;
  displayName: string;
  airspeedLimits: Readonly<AirspeedOperatingLimits>;
}

const requireText = (name: string, value: string): void => {
  if (value.trim().length === 0) {
    throw new TypeError(`${name} must be provided`);
  }
};

const requirePositiveFinite = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite speed`);
  }
};

export function createAircraftOperatingProfile(
  input: AircraftOperatingProfile
): Readonly<AircraftOperatingProfile> {
  requireText('profileId', input.profileId);
  requireText('manufacturer', input.manufacturer);
  requireText('model', input.model);
  requireText('displayName', input.displayName);

  const limits = { ...input.airspeedLimits };
  for (const [name, value] of Object.entries(limits)) {
    requirePositiveFinite(name, value);
  }
  if (limits.vsoKias > limits.vsKias) {
    throw new RangeError('vsoKias must be less than or equal to vsKias');
  }
  if (limits.vsKias >= limits.vaKias) {
    throw new RangeError('vsKias must be less than vaKias');
  }
  if (limits.vaKias > limits.vnoKias) {
    throw new RangeError('vaKias must be less than or equal to vnoKias');
  }
  if (limits.vnoKias >= limits.vneKias) {
    throw new RangeError('vnoKias must be less than vneKias');
  }
  if (limits.vfeKias <= limits.vsoKias || limits.vfeKias >= limits.vneKias) {
    throw new RangeError('vfeKias must fall between vsoKias and vneKias');
  }

  return Object.freeze({
    ...input,
    airspeedLimits: Object.freeze(limits),
  });
}

export const C172S_OPERATING_PROFILE = createAircraftOperatingProfile({
  profileId: 'cessna-172s',
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
});
