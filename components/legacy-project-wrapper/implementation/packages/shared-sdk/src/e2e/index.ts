/** Shared remote E2E contract. Import through @aviation/shared-sdk/e2e on test workers only. */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';

export const E2E_HEADERS = {
  run: 'x-aviation-test-run',
  expires: 'x-aviation-test-expires',
  signature: 'x-aviation-test-signature',
} as const;

export const E2E_MAX_AGE_MS = 15 * 60 * 1000;
const RUN_PATTERN = /^e2e_[0-9a-f]{32}$/;

export type E2ERunId = string & { readonly __e2eRunId: unique symbol };
export type TestTagged<T extends object> = T & {
  readonly is_test_data: true;
  readonly test_run_id: E2ERunId;
};
export type E2EHeaders = Record<(typeof E2E_HEADERS)[keyof typeof E2E_HEADERS], string>;
export type HeaderSource = Pick<Headers, 'get'> | Record<string, string | string[] | undefined>;

export function createE2ERunId(): E2ERunId {
  return `e2e_${randomUUID().replace(/-/g, '')}` as E2ERunId;
}

export function parseE2ERunId(value: unknown): E2ERunId {
  if (typeof value !== 'string' || !RUN_PATTERN.test(value)) throw new Error('Invalid E2E run ID');
  return value as E2ERunId;
}

/** Resolve a run-owned SQLite file under the caller's dedicated test root. */
export function isolatedSqlitePath(root: string, runId: E2ERunId): string {
  return resolve(root, `${parseE2ERunId(runId)}.db`);
}

export function tagTestData<T extends object>(runId: E2ERunId, value: T): TestTagged<T> {
  parseE2ERunId(runId);
  if ('is_test_data' in value || 'test_run_id' in value) throw new Error('Fixture already has data isolation fields');
  return { ...value, is_test_data: true, test_run_id: runId };
}

export function assertTestDataForRun(value: unknown, runId: E2ERunId): asserts value is TestTagged<object> {
  parseE2ERunId(runId);
  if (!value || typeof value !== 'object' || !('is_test_data' in value)
    || value.is_test_data !== true || !('test_run_id' in value) || value.test_run_id !== runId) {
    throw new Error('Record is not tagged for this E2E run');
  }
}

function signature(secret: string, appId: string, runId: E2ERunId, expiresAt: number): string {
  if (secret.length < 32) throw new Error('E2E secret must contain at least 32 characters');
  if (!/^[a-z0-9-]+$/.test(appId)) throw new Error('Invalid E2E application ID');
  return createHmac('sha256', secret).update(`${appId}\n${runId}\n${expiresAt}`).digest('hex');
}

export function signE2EHeaders(appId: string, runId: E2ERunId, secret: string,
  now = Date.now(), ttlMs = E2E_MAX_AGE_MS): E2EHeaders {
  parseE2ERunId(runId);
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > E2E_MAX_AGE_MS) {
    throw new Error('Invalid E2E credential lifetime');
  }
  const expiresAt = now + ttlMs;
  return {
    [E2E_HEADERS.run]: runId,
    [E2E_HEADERS.expires]: String(expiresAt),
    [E2E_HEADERS.signature]: signature(secret, appId, runId, expiresAt),
  } as E2EHeaders;
}

function getHeader(source: HeaderSource, name: string): string | undefined {
  if (typeof source.get === 'function') return source.get(name) ?? undefined;
  const entries = Object.entries(source).filter(([key]) => key.toLowerCase() === name);
  const value = entries.length === 1 ? entries[0][1] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function hasHeader(source: HeaderSource, name: string): boolean {
  if (typeof source.get === 'function') return source.get(name) != null;
  return Object.keys(source).some(key => key.toLowerCase() === name);
}

/** Missing credentials mean a production request; partial/invalid credentials are always rejected. */
export function verifyE2EHeaders(appId: string, source: HeaderSource, secret: string | undefined,
  now = Date.now()): E2ERunId | null {
  const run = getHeader(source, E2E_HEADERS.run);
  const expires = getHeader(source, E2E_HEADERS.expires);
  const supplied = getHeader(source, E2E_HEADERS.signature);
  if (!Object.values(E2E_HEADERS).some(name => hasHeader(source, name))) return null;
  if (!secret || !run || !expires || !supplied) throw new Error('Incomplete E2E credentials');
  const runId = parseE2ERunId(run);
  if (!/^\d{13}$/.test(expires)) throw new Error('Invalid E2E expiration');
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now || expiresAt > now + E2E_MAX_AGE_MS) {
    throw new Error('Expired or excessive E2E credential lifetime');
  }
  if (!/^[a-f0-9]{64}$/.test(supplied)) throw new Error('Invalid E2E signature');
  const expected = signature(secret, appId, runId, expiresAt);
  if (!timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new Error('Invalid E2E signature');
  }
  return runId;
}

export interface E2ERun {
  readonly id: E2ERunId;
  tag<T extends object>(value: T): TestTagged<T>;
  headersFor(appId: string): E2EHeaders;
  onCleanup(cleanup: () => Promise<void> | void): void;
}

export class E2ERunError extends Error {
  constructor(readonly causes: unknown[]) {
    super('E2E run or cleanup failed');
    this.name = 'E2ERunError';
  }
}

/** Execute cleanup in reverse order even when the test or an earlier cleanup fails. */
export async function withE2ERun<T>(secret: string, test: (run: E2ERun) => Promise<T>,
  existingRunId?: E2ERunId): Promise<T> {
  const id = existingRunId ? parseE2ERunId(existingRunId) : createE2ERunId();
  const cleanup: Array<() => Promise<void> | void> = [];
  const run: E2ERun = {
    id,
    tag: value => tagTestData(id, value),
    headersFor: appId => signE2EHeaders(appId, id, secret),
    onCleanup: callback => cleanup.push(callback),
  };
  let result: T | undefined;
  let failure: unknown;
  let failed = false;
  try { result = await test(run); }
  catch (error) { failure = error; failed = true; }
  const cleanupFailures: unknown[] = [];
  for (const callback of cleanup.reverse()) {
    try { await callback(); }
    catch (error) { cleanupFailures.push(error); }
  }
  if (failed || cleanupFailures.length) {
    throw new E2ERunError([...(failed ? [failure] : []), ...cleanupFailures]);
  }
  return result as T;
}

export { standardE2EFixtures, standardE2EMocks, standardForeFlightCsv } from './fixtures.js';
export { seedRemoteFixture, type FixtureApi } from './client.js';
export { installE2EApiHeaders, installE2ENetworkMocks, runE2EScreens,
  type E2EBrowserPage, type E2EBrowserRoute, type E2ENetworkMock, type E2EScreen } from './browser.js';
