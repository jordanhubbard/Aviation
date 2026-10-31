import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HealthReportError,
  createHealthReport,
  normalizeHealthStatus,
  type HealthReportOptions,
} from '../src/index.js';

type Vectors = {
  schema: string;
  normalizationCases: Array<{ input: string; expected: string }>;
  invalidStatusCases: string[];
  reportCases: Array<{ id: string; input: HealthReportOptions; expected: Record<string, unknown> }>;
  invalidReportCases: Array<{ id: string; input: HealthReportOptions; code: string }>;
};

const contract = JSON.parse(readFileSync(
  new URL('../../../acceptance/vectors.json', import.meta.url),
  'utf8',
)) as Vectors;

describe('aviation.service.health Component conformance', () => {
  it('uses the declared vector schema', () => {
    expect(contract.schema).toBe('aviation/service-health-acceptance-vectors@1');
  });

  for (const vector of contract.normalizationCases) {
    it(`normalizes ${JSON.stringify(vector.input)}`, () => {
      expect(normalizeHealthStatus(vector.input)).toBe(vector.expected);
    });
  }

  for (const status of contract.invalidStatusCases) {
    it(`rejects status ${JSON.stringify(status)}`, () => {
      expect(() => normalizeHealthStatus(status)).toThrowError(
        expect.objectContaining({ code: 'health-status-invalid' }),
      );
    });
  }

  for (const vector of contract.reportCases) {
    it(`builds ${vector.id} without mutation`, () => {
      const before = structuredClone(vector.input);
      expect(createHealthReport(vector.input)).toEqual(vector.expected);
      expect(vector.input).toEqual(before);
    });
  }

  for (const vector of contract.invalidReportCases) {
    it(`rejects ${vector.id}`, () => {
      try {
        createHealthReport(vector.input);
        throw new Error('report construction unexpectedly succeeded');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthReportError);
        expect((error as HealthReportError).code).toBe(vector.code);
      }
    });
  }
});
