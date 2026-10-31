import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  validateLogbookTime,
  type LogbookTimeInput,
} from '../logbook.js';

interface LogbookExpected {
  valid: boolean;
  normalizedPilotRole: string;
  normalizedPicTime: number;
  accountedTime: number | null;
  issueCodes: string[];
}

interface LogbookVectors {
  schema: string;
  defaultTolerance: number;
  cases: Array<{
    id: string;
    input: LogbookTimeInput;
    expected: LogbookExpected;
  }>;
  invalidRuntimeCases: Array<{
    id: string;
    field: string;
    runtimeValue: number | string;
    expectedIssueCode: string;
  }>;
}

const contract = loadConformanceContract<LogbookVectors>('logbook');

describe('aviation.logbook Component conformance', () => {
  it('uses the declared vector schema', () => {
    expect(contract.schema).toBe('aviation/logbook-acceptance-vectors@1');
    expect(contract.defaultTolerance).toBe(0.1);
  });

  for (const vector of contract.cases) {
    it(`validates ${vector.id}`, () => {
      const input = structuredClone(vector.input);
      const before = structuredClone(input);
      const result = validateLogbookTime(input, contract.defaultTolerance);

      expect({
        valid: result.valid,
        normalizedPilotRole: result.normalizedPilotRole,
        normalizedPicTime: result.normalizedPicTime,
        accountedTime: result.accountedTime,
        issueCodes: result.issues.map((candidate) => candidate.code),
      }).toEqual(vector.expected);
      expect(input).toEqual(before);
    });
  }

  for (const vector of contract.invalidRuntimeCases) {
    it(`fails closed for ${vector.id}`, () => {
      const input: LogbookTimeInput = {
        totalTime: 1,
        picTime: 1,
        dayTime: 1,
        pilotRole: 'PIC',
      };
      const runtimeValue = vector.runtimeValue === 'positive-infinity'
        ? Number.POSITIVE_INFINITY
        : vector.runtimeValue === 'not-a-number'
          ? Number.NaN
          : vector.runtimeValue;
      const result = vector.field === 'tolerance'
        ? validateLogbookTime(input, runtimeValue as number)
        : validateLogbookTime({
          ...input,
          [vector.field]: runtimeValue,
        } as LogbookTimeInput);

      expect(result.valid).toBe(false);
      expect(result.accountedTime).toBeNull();
      expect(result.issues.map((candidate) => candidate.code))
        .toContain(vector.expectedIssueCode);
    });
  }
});

