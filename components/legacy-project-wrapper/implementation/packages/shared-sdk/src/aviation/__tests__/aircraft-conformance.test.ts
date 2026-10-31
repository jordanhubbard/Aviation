import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  C172S_OPERATING_PROFILE,
  createAircraftOperatingProfile,
  type AircraftOperatingProfile,
  type AirspeedOperatingLimits,
} from '../aircraft.js';

interface AircraftVectors {
  schema: string;
  profiles: Record<string, AircraftOperatingProfile>;
  invalidMutations: Array<{
    id: string;
    field: keyof AirspeedOperatingLimits;
    value: number | 'non-finite';
  }>;
}

const contract = loadConformanceContract<AircraftVectors>('aircraft');

describe('aviation.aircraft Component conformance', () => {
  it('exports the Component-owned C172S operating profile', () => {
    expect(contract.schema).toBe('aviation/aircraft-acceptance-vectors@1');
    expect(C172S_OPERATING_PROFILE).toEqual(contract.profiles['cessna-172s']);
    expect(Object.isFrozen(C172S_OPERATING_PROFILE)).toBe(true);
    expect(Object.isFrozen(C172S_OPERATING_PROFILE.airspeedLimits)).toBe(true);
  });

  for (const mutation of contract.invalidMutations) {
    it(`rejects ${mutation.id}`, () => {
      const profile = contract.profiles['cessna-172s'];
      const value = mutation.value === 'non-finite' ? Number.NaN : mutation.value;
      expect(() => createAircraftOperatingProfile({
        ...profile,
        airspeedLimits: {
          ...profile.airspeedLimits,
          [mutation.field]: value,
        },
      })).toThrow();
    });
  }
});
