import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  calculateLoad,
  interpolateEnvelope,
  type LoadingInput,
  type LoadingProfile,
  type LoadingResult,
} from '../weight-balance.js';

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
  profile: LoadingProfile;
  vectors: WeightBalanceVector[];
}

const contract = loadConformanceContract<WeightBalanceVectors>('weight-balance');

function execute(vector: WeightBalanceVector): unknown {
  if (vector.operation === 'interpolate_envelope') {
    return interpolateEnvelope(
      (vector.args[1] as LoadingProfile['envelope'] | undefined) ?? contract.profile.envelope,
      vector.args[0] as number
    );
  }
  return calculateLoad(contract.profile, vector.args[0] as LoadingInput);
}

describe('aviation.weight-balance Component conformance', () => {
  it('uses the versioned Component-owned vector schema', () => {
    expect(contract.schema).toBe('aviation/weight-balance-acceptance-vectors@1');
    expect(contract.vectors.length).toBeGreaterThan(0);
  });

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
});
