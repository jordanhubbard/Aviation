import { basename, dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  E2EContractError, createE2ELease, classifyE2ELease,
  assertTestDataForRun,
  isolatedRunDirectory,
  isolatedSqlitePath,
  parseE2ERunId,
  signE2EHeaders,
  tagTestData,
  verifyE2EHeaders,
  type E2ERunId,
} from '../../e2e/index.js';

type InvalidCase = { id: string; code: string };
type Vectors = {
  schema: string;
  leaseCreationCases: Array<{id: string; appId: string; runId: E2ERunId; nowMs: number; ttlMs: number; expected: object}>;
  invalidLeaseCreationCases: Array<InvalidCase & {appId: string; runId: E2ERunId; nowMs: number; ttlMs: number}>;
  leaseClassificationCases: Array<{id: string; appId: string; nowMs: number; input: unknown; expected: string}>;
  runIdCases: Array<{ id: string; input: string; expected: string }>;
  invalidRunIdCases: Array<InvalidCase & { input: unknown }>;
  pathCases: Array<{
    id: string;
    root: string;
    runId: E2ERunId;
    expectedDirectoryLeaf: string;
    expectedSqliteLeaf: string;
  }>;
  tagCases: Array<{
    id: string;
    runId: E2ERunId;
    input: Record<string, unknown>;
    expected: Record<string, unknown>;
  }>;
  invalidRecordCases: Array<InvalidCase & {
    operation: 'tag' | 'assert';
    runId: E2ERunId;
    input: Record<string, unknown>;
  }>;
  signingCases: Array<{
    id: string;
    appId: string;
    runId: E2ERunId;
    secret: string;
    nowMs: number;
    ttlMs: number;
    expected: Record<string, string>;
  }>;
  verificationCases: Array<{
    id: string;
    appId: string;
    secret: string;
    nowMs: number;
    headers: Record<string, string>;
    expected: string | null;
  }>;
  invalidCredentialCases: Array<InvalidCase & {
    appId: string;
    secret: string | null;
    nowMs: number;
    headers: Record<string, string>;
  }>;
};

const contract = loadConformanceContract<Vectors>('testing-e2e');

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('operation unexpectedly succeeded');
  } catch (error) {
    expect(error).toBeInstanceOf(E2EContractError);
    expect((error as E2EContractError).code).toBe(code);
  }
}

describe('aviation.testing.e2e Component conformance', () => {
  it('uses the declared vector schema', () => {
    expect(contract.schema).toBe('aviation/testing-e2e-acceptance-vectors@1');
  });

  for (const vector of contract.runIdCases) {
    it(`parses ${vector.id}`, () => {
      expect(parseE2ERunId(vector.input)).toBe(vector.expected);
    });
  }

  for (const vector of contract.invalidRunIdCases) {
    it(`rejects run identity ${vector.id}`, () => {
      expectCode(() => parseE2ERunId(vector.input), vector.code);
    });
  }

  for (const vector of contract.pathCases) {
    it(`derives ${vector.id} without filesystem side effects`, () => {
      const directory = isolatedRunDirectory(vector.root, vector.runId);
      const sqlite = isolatedSqlitePath(vector.root, vector.runId);
      expect(basename(directory)).toBe(vector.expectedDirectoryLeaf);
      expect(basename(sqlite)).toBe(vector.expectedSqliteLeaf);
      expect(dirname(directory)).toBe(resolve(vector.root));
      expect(dirname(sqlite)).toBe(resolve(vector.root));
    });
  }

  for (const vector of contract.tagCases) {
    it(`tags ${vector.id} without mutation`, () => {
      const before = structuredClone(vector.input);
      const tagged = tagTestData(vector.runId, vector.input);
      expect(tagged).toEqual(vector.expected);
      expect(vector.input).toEqual(before);
      expect(() => assertTestDataForRun(tagged, vector.runId)).not.toThrow();
    });
  }

  for (const vector of contract.invalidRecordCases) {
    it(`rejects record ${vector.id}`, () => {
      const before = structuredClone(vector.input);
      const action = vector.operation === 'tag'
        ? () => tagTestData(vector.runId, vector.input)
        : () => assertTestDataForRun(vector.input, vector.runId);
      expectCode(action, vector.code);
      expect(vector.input).toEqual(before);
    });
  }

  for (const vector of contract.signingCases) {
    it(`signs ${vector.id}`, () => {
      expect(signE2EHeaders(
        vector.appId,
        vector.runId,
        vector.secret,
        vector.nowMs,
        vector.ttlMs,
      )).toEqual(vector.expected);
    });
  }

  for (const vector of contract.verificationCases) {
    it(`verifies ${vector.id}`, () => {
      expect(verifyE2EHeaders(
        vector.appId,
        vector.headers,
        vector.secret,
        vector.nowMs,
      )).toBe(vector.expected);
    });
  }

  for (const vector of contract.invalidCredentialCases) {
    it(`rejects credential ${vector.id}`, () => {
      expectCode(() => verifyE2EHeaders(
        vector.appId,
        vector.headers,
        vector.secret ?? undefined,
        vector.nowMs,
      ), vector.code);
    });
  }
});


describe('Component resource lease conformance', () => {
  for (const v of contract.leaseCreationCases) it(v.id, () => {
    expect(createE2ELease(v.appId, v.runId, v.nowMs, v.ttlMs)).toEqual(v.expected);
  });
  for (const v of contract.invalidLeaseCreationCases) it(v.id, () => {
    expectCode(() => createE2ELease(v.appId, v.runId, v.nowMs, v.ttlMs), v.code);
  });
  for (const v of contract.leaseClassificationCases) it(v.id, () => {
    const before = structuredClone(v.input);
    expect(classifyE2ELease(v.input, v.appId, v.nowMs)).toBe(v.expected);
    expect(v.input).toEqual(before);
  });
});
