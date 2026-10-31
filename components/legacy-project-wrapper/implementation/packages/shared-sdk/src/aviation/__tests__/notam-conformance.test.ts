import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  NotamValidationError,
  categorizeNotam,
  categorizeNotamSeverity,
  filterRelevantNotams,
  formatNotamText,
  isNotamEffective,
  normalizeNotamRecord,
  sortNotamsBySeverity,
  type NOTAM,
  type NotamRecordInput,
} from '../notam.js';

type PortableExpected = {
  id: string;
  type: string;
  location: string;
  facilityType: string;
  effectiveStart: string;
  effectiveEnd: string;
  classification: string;
  text: string;
  severity: string;
  category: string;
};

type NotamVectors = {
  schema: string;
  referenceTime: string;
  normalizationCases: Array<{
    id: string;
    input: NotamRecordInput;
    expected: PortableExpected;
  }>;
  invalidNormalizationCases: Array<{
    id: string;
    input: NotamRecordInput;
    expectedErrorCode: string;
  }>;
  classificationCases: Array<{
    id: string;
    text: string;
    severity: string;
    category: string;
  }>;
  formatCases: Array<{ id: string; input: string; expected: string }>;
  records: NotamRecordInput[];
  effectiveCases: Array<{
    id: string;
    recordId: string;
    instant: string;
    expected: boolean;
  }>;
  filterCases: Array<{
    id: string;
    routeIcaos: string[];
    includeEnroute: boolean;
    expectedIds: string[];
  }>;
  expectedSeverityOrder: string[];
};

const contract = loadConformanceContract<NotamVectors>('notam');

const portable = (notam: NOTAM): PortableExpected => ({
  id: notam.id,
  type: notam.type,
  location: notam.location,
  facilityType: notam.facilityType,
  effectiveStart: notam.effectiveStart.toISOString(),
  effectiveEnd: notam.effectiveEnd.toISOString(),
  classification: notam.classification,
  text: notam.text,
  severity: notam.severity,
  category: notam.category ?? 'General',
});
describe('aviation.notam Component conformance', () => {
  it('uses the declared vector schema', () => {
    expect(contract.schema).toBe('aviation/notam-acceptance-vectors@1');
  });

  for (const vector of contract.normalizationCases) {
    it(`normalizes ${vector.id}`, () => {
      const input = structuredClone(vector.input);
      const before = structuredClone(input);
      expect(portable(normalizeNotamRecord(input))).toEqual(vector.expected);
      expect(input).toEqual(before);
    });
  }

  for (const vector of contract.invalidNormalizationCases) {
    it(`rejects ${vector.id}`, () => {
      try {
        normalizeNotamRecord(vector.input);
        throw new Error('normalization unexpectedly succeeded');
      } catch (error) {
        expect(error).toBeInstanceOf(NotamValidationError);
        expect((error as NotamValidationError).code).toBe(vector.expectedErrorCode);
      }
    });
  }

  for (const vector of contract.classificationCases) {
    it(`classifies ${vector.id}`, () => {
      const record = normalizeNotamRecord({
        id: vector.id,
        location: 'KAAA',
        effectiveStart: '2026-10-31T10:00:00Z',
        effectiveEnd: '2026-10-31T14:00:00Z',
        text: vector.text,
      });
      expect(categorizeNotamSeverity(record)).toBe(vector.severity);
      expect(categorizeNotam(vector.text)).toBe(vector.category);
    });
  }

  for (const vector of contract.formatCases) {
    it(`formats ${vector.id}`, () => {
      expect(formatNotamText(vector.input)).toBe(vector.expected);
    });
  }

  const records = contract.records.map(normalizeNotamRecord);

  for (const vector of contract.effectiveCases) {
    it(`evaluates ${vector.id}`, () => {
      const record = records.find((candidate) => candidate.id === vector.recordId.toUpperCase());
      expect(record).toBeDefined();
      expect(isNotamEffective(record!, new Date(vector.instant))).toBe(vector.expected);
    });
  }

  for (const vector of contract.filterCases) {
    it(`filters ${vector.id}`, () => {
      const result = filterRelevantNotams(
        records,
        vector.routeIcaos,
        vector.includeEnroute,
        new Date(contract.referenceTime)
      );
      expect(result.map((candidate) => candidate.id)).toEqual(vector.expectedIds);
    });
  }

  it('sorts by severity without mutating input order', () => {
    const before = records.map((candidate) => candidate.id);
    expect(sortNotamsBySeverity(records).map((candidate) => candidate.id))
      .toEqual(contract.expectedSeverityOrder);
    expect(records.map((candidate) => candidate.id)).toEqual(before);
  });
});

