import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  C172S_OPERATING_PROFILE,
  C182T_OPERATING_PROFILE,
  SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
  createAircraftOperatingProfile,
  findAircraftOperatingProfile,
  matchAircraftOperatingProfile,
  type AircraftOperatingProfile,
} from '../aircraft.js';

interface AircraftVectors {
  schema: string;
  profiles: Record<string, AircraftOperatingProfile>;
  lookups: Array<{
    query: string;
    expectedProfileId: string | null;
  }>;
  identityMatches: Array<{
    manufacturer: string;
    model: string;
    expectedProfileId: string | null;
  }>;
  invalidMutations: Array<{
    id: string;
    path: string[];
    value: number | string;
  }>;
}

const contract = loadConformanceContract<AircraftVectors>('aircraft');

const mutateProfile = (
  profile: AircraftOperatingProfile,
  path: string[],
  value: number | string
): AircraftOperatingProfile => {
  const result = structuredClone(profile) as unknown as Record<string, unknown>;
  let target = result;
  for (const segment of path.slice(0, -1)) {
    target = target[segment] as Record<string, unknown>;
  }
  target[path[path.length - 1]] = value === 'non-finite' ? Number.NaN : value;
  return result as unknown as AircraftOperatingProfile;
};

describe('aviation.aircraft Component conformance', () => {
  it('exports every Component-owned operating profile', () => {
    expect(contract.schema).toBe('aviation/aircraft-acceptance-vectors@4');
    const profiles = [
      C172S_OPERATING_PROFILE,
      C182T_OPERATING_PROFILE,
      SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
    ];
    for (const profile of profiles) {
      expect(profile).toEqual(contract.profiles[profile.profileId]);
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.airspeedLimits)).toBe(true);
      expect(Object.isFrozen(profile.fuelLimits)).toBe(true);
      expect(Object.isFrozen(profile.weightLimits)).toBe(true);
      expect(Object.isFrozen(profile.dimensions)).toBe(true);
      expect(Object.isFrozen(profile.referencePerformance)).toBe(true);
    }
  });

  for (const lookup of contract.lookups) {
    it(`resolves bundled profile lookup ${lookup.query}`, () => {
      expect(findAircraftOperatingProfile(lookup.query)?.profileId ?? null)
        .toBe(lookup.expectedProfileId);
    });
  }

  for (const identity of contract.identityMatches) {
    it(`matches bundled profile identity ${identity.manufacturer}/${identity.model}`, () => {
      expect(matchAircraftOperatingProfile(identity.manufacturer, identity.model)?.profileId ?? null)
        .toBe(identity.expectedProfileId);
    });
  }

  for (const mutation of contract.invalidMutations) {
    it(`rejects ${mutation.id}`, () => {
      const profile = contract.profiles['cessna-172s'];
      expect(() => createAircraftOperatingProfile(
        mutateProfile(profile, mutation.path, mutation.value)
      )).toThrow();
    });
  }
});
