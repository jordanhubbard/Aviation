import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  C172S_LOADING_PROFILE,
  calculateLoad,
  createLoadingProfile,
  findLoadingProfile,
  interpolateEnvelope,
  type LoadingInput,
  type LoadingProfile,
  type LoadingResult,
  type QualifiedLoadingProfile,
} from '../weight-balance.js';
import { C172S_OPERATING_PROFILE } from '../aircraft.js';

interface WeightBalanceVector {
  id: string;
  operation: 'interpolate_envelope' | 'calculate_load';
  args: unknown[];
  expected?: unknown;
  expected_problems?: string[];
  expected_error?: 'invalid_input';
}

interface WeightBalanceVectors {
  schema: string;
  profiles: Record<string, QualifiedLoadingProfile>;
  lookups: Array<{ query: string; expectedProfileId: string | null }>;
  vectors: WeightBalanceVector[];
  invalidProfileMutations: Array<{
    id: string;
    path: Array<string | number>;
    value: number | string;
  }>;
}

const contract = loadConformanceContract<WeightBalanceVectors>('weight-balance');
const profile = contract.profiles['cessna-172s-sample-loading'];

function execute(vector: WeightBalanceVector): unknown {
  if (vector.operation === 'interpolate_envelope') {
    return interpolateEnvelope(
      (vector.args[1] as LoadingProfile['envelope'] | undefined) ?? profile.envelope,
      vector.args[0] as number
    );
  }
  return calculateLoad(profile, vector.args[0] as LoadingInput);
}

describe('aviation.weight-balance Component conformance', () => {
  it('uses the versioned Component-owned vector schema', () => {
    expect(contract.schema).toBe('aviation/weight-balance-acceptance-vectors@2');
    expect(contract.vectors.length).toBeGreaterThan(0);
  });

  it('matches the bundled C172S loading profile', () => {
    expect(C172S_LOADING_PROFILE).toEqual(profile);
    expect(C172S_LOADING_PROFILE.aircraftProfileId).toBe(C172S_OPERATING_PROFILE.profileId);
    expect(C172S_LOADING_PROFILE.maxGross).toBe(
      C172S_OPERATING_PROFILE.weightLimits.maximumTakeoffWeightLb
    );
    expect(C172S_LOADING_PROFILE.usableFuelCapacity).toBe(
      C172S_OPERATING_PROFILE.fuelLimits.usableCapacityGal
    );
  });

  for (const lookup of contract.lookups) {
    it(`lookup ${lookup.query}`, () => {
      expect(findLoadingProfile(lookup.query)?.profileId ?? null).toBe(lookup.expectedProfileId);
    });
  }

  for (const vector of contract.vectors) {
    it(vector.id, () => {
      if (vector.expected_error) {
        expect(() => execute(vector)).toThrow();
        return;
      }
      const actual = execute(vector);
      if (vector.expected_problems) {
        const result = actual as LoadingResult;
        expect(result.takeoff.problems).toEqual(expect.arrayContaining(vector.expected_problems));
        return;
      }
      expect(actual).toEqual(vector.expected);
    });
  }

  for (const mutation of contract.invalidProfileMutations) {
    it(`rejects ${mutation.id}`, () => {
      const candidate = structuredClone(profile) as unknown as Record<string, unknown>;
      let target = candidate;
      for (const segment of mutation.path.slice(0, -1)) {
        target = target[segment] as Record<string, unknown>;
      }
      const value = mutation.value === 'non-finite' ? Number.NaN : mutation.value;
      target[mutation.path.at(-1)!] = value;
      expect(() =>
        createLoadingProfile(
          candidate as unknown as QualifiedLoadingProfile,
          C172S_OPERATING_PROFILE
        )
      ).toThrow();
    });
  }
});
