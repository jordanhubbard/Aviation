import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  AlertLifecycleError,
  alertPriority,
  highestAlertLevel,
  normalizeAlertLevel,
  orderAlerts,
  reconcileAcknowledgements,
  type AlertLifecycleRecord,
} from '../alerts.js';

type Vectors = {
  schema: string;
  normalizationCases: Array<{ input: string; expected: string; priority: number }>;
  invalidLevelCases: string[];
  orderingCases: Array<{
    id: string;
    input: AlertLifecycleRecord[];
    expectedIds: string[];
  }>;
  reconciliationCases: Array<{
    id: string;
    activeIds: string[];
    acknowledgedIds: string[];
    expected: string[];
  }>;
  highestCases: Array<{
    id: string;
    alerts: AlertLifecycleRecord[];
    includeAcknowledged: boolean;
    expected: string;
  }>;
};

const contract = loadConformanceContract<Vectors>('alerts');

describe('aviation.alerts Component conformance', () => {
  it('uses the declared vector schema', () => {
    expect(contract.schema).toBe('aviation/alerts-acceptance-vectors@1');
  });

  for (const vector of contract.normalizationCases) {
    it(`normalizes ${JSON.stringify(vector.input)}`, () => {
      expect(normalizeAlertLevel(vector.input)).toBe(vector.expected);
      expect(alertPriority(vector.input)).toBe(vector.priority);
    });
  }

  for (const level of contract.invalidLevelCases) {
    it(`rejects ${JSON.stringify(level)}`, () => {
      try {
        normalizeAlertLevel(level);
        throw new Error('normalization unexpectedly succeeded');
      } catch (error) {
        expect(error).toBeInstanceOf(AlertLifecycleError);
        expect((error as AlertLifecycleError).code).toBe('alert-level-invalid');
      }
    });
  }

  for (const vector of contract.orderingCases) {
    it(`orders ${vector.id} without mutation`, () => {
      const before = structuredClone(vector.input);
      expect(orderAlerts(vector.input).map(({ id }) => id)).toEqual(vector.expectedIds);
      expect(vector.input).toEqual(before);
    });
  }

  for (const vector of contract.reconciliationCases) {
    it(`reconciles ${vector.id} without mutation`, () => {
      const activeBefore = [...vector.activeIds];
      const acknowledgedBefore = [...vector.acknowledgedIds];
      expect(reconcileAcknowledgements(vector.activeIds, vector.acknowledgedIds))
        .toEqual(vector.expected);
      expect(vector.activeIds).toEqual(activeBefore);
      expect(vector.acknowledgedIds).toEqual(acknowledgedBefore);
    });
  }

  for (const vector of contract.highestCases) {
    it(`selects ${vector.id}`, () => {
      expect(highestAlertLevel(vector.alerts, vector.includeAcknowledged))
        .toBe(vector.expected);
    });
  }
});
