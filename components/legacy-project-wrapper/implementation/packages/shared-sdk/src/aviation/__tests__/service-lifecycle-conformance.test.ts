import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  ServiceLifecycleError,
  transitionServiceLifecycle,
  type ServiceLifecycleEvent,
  type ServiceLifecycleState,
} from '../service-lifecycle.js';

type SequenceCase = {
  id: string;
  initial: ServiceLifecycleState;
  events: ServiceLifecycleEvent[];
  expectedStates: ServiceLifecycleState[];
};

type Vectors = {
  schema: string;
  sequenceCases: SequenceCase[];
  invalidTransitionCases: Array<{
    id: string;
    state: ServiceLifecycleState;
    event: ServiceLifecycleEvent;
  }>;
};

const contract = loadConformanceContract<Vectors>('service-lifecycle');

describe('aviation.service.lifecycle Component conformance', () => {
  it('uses the declared vector schema', () => {
    expect(contract.schema).toBe('aviation/service-lifecycle-acceptance-vectors@1');
  });

  for (const vector of contract.sequenceCases) {
    it(`applies ${vector.id} without mutating the vector`, () => {
      const before = structuredClone(vector);
      let state = vector.initial;
      const actualStates = vector.events.map((event) => {
        state = transitionServiceLifecycle(state, event);
        return state;
      });
      expect(actualStates).toEqual(vector.expectedStates);
      expect(vector).toEqual(before);
    });
  }

  for (const vector of contract.invalidTransitionCases) {
    it(`rejects ${vector.id}`, () => {
      try {
        transitionServiceLifecycle(vector.state, vector.event);
        throw new Error('transition unexpectedly succeeded');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceLifecycleError);
        expect((error as ServiceLifecycleError).code).toBe(
          'service-lifecycle-transition-invalid',
        );
      }
    });
  }
});
