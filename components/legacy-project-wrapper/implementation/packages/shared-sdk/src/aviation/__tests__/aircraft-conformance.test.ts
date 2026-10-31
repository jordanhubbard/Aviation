import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  C172S_OPERATING_PROFILE,
  createAircraftOperatingProfile,
  findAircraftOperatingProfile,
  type AircraftOperatingProfile,
} from '../aircraft.js';

interface AircraftVectors {
  schema: string;
  profiles: Record<string, AircraftOperatingProfile>;
  lookups: Array<{
    query: string;
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
  it('exports the Component-owned C172S operating profile', () => {
    expect(contract.schema).toBe('aviation/aircraft-acceptance-vectors@2');
    expect(C172S_OPERATING_PROFILE).toEqual(contract.profiles['cessna-172s']);
    expect(Object.isFrozen(C172S_OPERATING_PROFILE)).toBe(true);
    expect(Object.isFrozen(C172S_OPERATING_PROFILE.airspeedLimits)).toBe(true);
    expect(Object.isFrozen(C172S_OPERATING_PROFILE.fuelLimits)).toBe(true);
    expect(Object.isFrozen(C172S_OPERATING_PROFILE.weightLimits)).toBe(true);
    expect(Object.isFrozen(C172S_OPERATING_PROFILE.dimensions)).toBe(true);
    expect(Object.isFrozen(C172S_OPERATING_PROFILE.referencePerformance)).toBe(true);
  });

  for (const lookup of contract.lookups) {
    it(`resolves bundled profile lookup ${lookup.query}`, () => {
      expect(findAircraftOperatingProfile(lookup.query)?.profileId ?? null)
        .toBe(lookup.expectedProfileId);
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
