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
const APP_PATTERN = /^[a-z0-9-]+$/;

export class E2EContractError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'E2EContractError';
  }
}

function fail(code: string, message: string): never {
  throw new E2EContractError(code, message);
}

export type E2ERunId = string & { readonly __e2eRunId: unique symbol };
export type TestTagged<T extends object> = T & {
  readonly is_test_data: true;
  readonly test_run_id: E2ERunId;
};
export type E2EHeaders = Record<(typeof E2E_HEADERS)[keyof typeof E2E_HEADERS], string>;
export type HeaderSource = Pick<Headers, 'get'> | Record<string, string | string[] | undefined>;

function validAppId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && APP_PATTERN.test(value);
}

function validRunId(value: unknown): value is E2ERunId {
  return typeof value === 'string' && value.length === 36 && RUN_PATTERN.test(value);
}

export function createE2ERunId(): E2ERunId {
  return `e2e_${randomUUID().replace(/-/g, '')}` as E2ERunId;
}

export function parseE2ERunId(value: unknown): E2ERunId {
  if (!validRunId(value)) {
    fail('e2e-run-id-invalid', 'invalid E2E run ID');
  }
  return value as E2ERunId;
}

/** Resolve a run-owned directory under the caller's dedicated test root. */
export function isolatedRunDirectory(root: string, runId: E2ERunId): string {
  return resolve(root, parseE2ERunId(runId));
}

/** Resolve a run-owned SQLite file under the caller's dedicated test root. */
export function isolatedSqlitePath(root: string, runId: E2ERunId): string {
  return resolve(root, `${parseE2ERunId(runId)}.db`);
}

export function tagTestData<T extends object>(runId: E2ERunId, value: T): TestTagged<T> {
  parseE2ERunId(runId);
  if ('is_test_data' in value || 'test_run_id' in value) {
    fail('e2e-record-fields-present', 'record already has test isolation fields');
  }
  return { ...value, is_test_data: true, test_run_id: runId };
}

export function assertTestDataForRun(value: unknown, runId: E2ERunId): asserts value is TestTagged<object> {
  parseE2ERunId(runId);
  if (!value || typeof value !== 'object' || !('is_test_data' in value)
    || value.is_test_data !== true || !('test_run_id' in value) || value.test_run_id !== runId) {
    fail('e2e-record-run-mismatch', 'record is not tagged for this E2E run');
  }
}

function signature(secret: string, appId: string, runId: E2ERunId, expiresAt: number): string {
  if (secret.length < 32) fail('e2e-secret-invalid', 'E2E secret must contain at least 32 characters');
  if (!validAppId(appId)) fail('e2e-app-id-invalid', 'invalid E2E application ID');
  return createHmac('sha256', secret).update(`${appId}\n${runId}\n${expiresAt}`).digest('hex');
}

export function signE2EHeaders(appId: string, runId: E2ERunId, secret: string,
  now = Date.now(), ttlMs = E2E_MAX_AGE_MS): E2EHeaders {
  parseE2ERunId(runId);
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > E2E_MAX_AGE_MS) {
    fail('e2e-credential-lifetime-invalid', 'invalid E2E credential lifetime');
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
  if (entries.length > 1) fail('e2e-header-duplicate', `duplicate E2E header: ${name}`);
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
  if (!validAppId(appId)) fail('e2e-app-id-invalid', 'invalid E2E application ID');
  const run = getHeader(source, E2E_HEADERS.run);
  const expires = getHeader(source, E2E_HEADERS.expires);
  const supplied = getHeader(source, E2E_HEADERS.signature);
  if (!Object.values(E2E_HEADERS).some(name => hasHeader(source, name))) return null;
  if (!secret || secret.length < 32) fail('e2e-secret-invalid', 'invalid E2E secret');
  if (!run || !expires || !supplied) fail('e2e-credentials-incomplete', 'incomplete E2E credentials');
  const runId = parseE2ERunId(run);
  if (!/^\d{13}$/.test(expires)) fail('e2e-expiration-invalid', 'invalid E2E expiration');
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(expiresAt)) {
    fail('e2e-expiration-invalid', 'invalid E2E expiration');
  }
  if (expiresAt < now) fail('e2e-credentials-expired', 'expired E2E credentials');
  if (expiresAt > now + E2E_MAX_AGE_MS) {
    fail('e2e-credential-lifetime-invalid', 'excessive E2E credential lifetime');
  }
  if (!/^[a-f0-9]{64}$/.test(supplied)) fail('e2e-signature-invalid', 'invalid E2E signature');
  const expected = signature(secret, appId, runId, expiresAt);
  if (!timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(expected, 'hex'))) {
    fail('e2e-signature-invalid', 'invalid E2E signature');
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
    // Stay below the verification ceiling so small client/server clock offsets do not reject fresh traffic.
    headersFor: appId => signE2EHeaders(appId, id, secret, Date.now(), 5 * 60 * 1000),
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

export interface E2ELease {
  readonly schema: 'aviation/e2e-lease@1';
  readonly app_id: string;
  readonly is_test_data: true;
  readonly test_run_id: E2ERunId;
  readonly issued_at_ms: number;
  readonly expires_at_ms: number;
}

export function createE2ELease(appId: string, runId: E2ERunId, now = Date.now(),
  ttlMs = E2E_MAX_AGE_MS): E2ELease {
  if (!validAppId(appId)) fail('e2e-app-id-invalid', 'invalid E2E application ID');
  parseE2ERunId(runId);
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(ttlMs)
    || ttlMs < 1 || ttlMs > E2E_MAX_AGE_MS || !Number.isSafeInteger(now + ttlMs)) {
    fail('e2e-lease-lifetime-invalid', 'invalid E2E resource lease lifetime');
  }
  return tagTestData(runId, { schema: 'aviation/e2e-lease@1' as const, app_id: appId,
    issued_at_ms: now, expires_at_ms: now + ttlMs });
}

/** Invalid or foreign metadata never grants permission to remove a resource. */
export function classifyE2ELease(value: unknown, appId: string, now = Date.now()): 'active' | 'expired' | 'unowned' {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !validAppId(appId)
    || !Number.isSafeInteger(now) || now < 0) return 'unowned';
  const lease = value as Partial<E2ELease>;
  if (lease.schema !== 'aviation/e2e-lease@1' || lease.app_id !== appId || lease.is_test_data !== true
    || !validRunId(lease.test_run_id)
    || !Number.isSafeInteger(lease.issued_at_ms) || !Number.isSafeInteger(lease.expires_at_ms)) return 'unowned';
  const issued = lease.issued_at_ms!; const expires = lease.expires_at_ms!;
  if (issued < 0 || issued > now || expires <= issued || expires - issued > E2E_MAX_AGE_MS) return 'unowned';
  return expires <= now ? 'expired' : 'active';
}

/** Deadline for a private PID namespace; container exit discards all namespace children. */
export function e2eNamespaceDeadlineCommand(command: readonly string[], lifetimeMs: number, graceMs = 2000, expiresAtMs?: number): string[] {
  if (!command.length || command.some(arg => typeof arg !== 'string' || arg.includes('\0')) || !command[0]
    || !Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > E2E_MAX_AGE_MS
    || !Number.isSafeInteger(graceMs) || graceMs < 1 || graceMs > 10000
    || (expiresAtMs !== undefined && (!Number.isSafeInteger(expiresAtMs) || expiresAtMs < 0))) {
    throw new Error('Invalid E2E foreground command deadline');
  }
  const script = `
ttl=$1; grace=$2; deadline=$3; shift 3
if [ "$deadline" -ge 0 ]; then
  now=$(date +%s) || exit 125
  case "$now" in ''|*[!0-9]*) exit 125;; esac
  remaining=$((deadline - now))
  [ "$remaining" -gt 0 ] || exit 124
  if [ "$remaining" -lt "$ttl" ]; then ttl=$remaining; fi
fi
exec 3<&0
"$@" <&3 & app_pid=$!
(
  sleeper=''
  trap 'if [ -n "$sleeper" ]; then kill -TERM "$sleeper" 2>/dev/null || :; wait "$sleeper" 2>/dev/null || :; fi; exit 0' TERM INT
  sleep "$ttl" & sleeper=$!; wait "$sleeper"
  kill -TERM "$app_pid" 2>/dev/null || :
  sleep "$grace" & sleeper=$!; wait "$sleeper"
  kill -KILL "$app_pid" 2>/dev/null || :
) & timer_pid=$!
interrupted=0
trap 'interrupted=1; kill -TERM "$app_pid" 2>/dev/null || :' TERM INT
wait "$app_pid"; result=$?
if [ "$interrupted" -eq 1 ]; then wait "$app_pid"; result=$?; fi
kill -TERM "$timer_pid" 2>/dev/null || :
wait "$timer_pid" 2>/dev/null || :
exit "$result"
`;
  return ['sh', '-c', script, 'aviation-e2e-deadline', String(Math.ceil(lifetimeMs / 1000)),
    String(Math.ceil(graceMs / 1000)), expiresAtMs === undefined ? '-1' : String(Math.ceil(expiresAtMs / 1000)), ...command];
}

/** Host supervisor owns its process handle and cancels timers on exit, avoiding stale-PID signals. */
export function e2eHostDeadlineCommand(command: readonly string[], lifetimeMs: number,
  graceMs = 2000, expiresAtMs?: number): string[] {
  // Reuse input validation without executing the namespace command.
  e2eNamespaceDeadlineCommand(command, lifetimeMs, graceMs, expiresAtMs);
  const script = `
const { spawn } = require('node:child_process');
const options = JSON.parse(process.argv[1]);
const remaining = Math.min(options.lifetimeMs, options.expiresAtMs === undefined
  ? options.lifetimeMs : options.expiresAtMs - Date.now());
if (remaining <= 0) process.exit(124);
const child = spawn(options.command[0], options.command.slice(1), { stdio: 'inherit' });
let expired = false;
let escalation;
const terminate = () => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  if (!escalation) escalation = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }, options.graceMs);
};
const timer = setTimeout(() => { expired = true; terminate(); }, remaining);
process.on('SIGTERM', terminate);
process.on('SIGINT', terminate);
child.once('error', () => { clearTimeout(timer); clearTimeout(escalation); process.exitCode = 125; });
child.once('close', code => {
  clearTimeout(timer); clearTimeout(escalation);
  process.exitCode = expired ? 124 : (code === null || code < 0 ? 125 : code);
});
`;
  return [process.execPath, '-e', script, JSON.stringify({ command, lifetimeMs, graceMs, expiresAtMs })];
}

export { standardE2EFixtures, standardE2EMocks, standardForeFlightCsv } from './fixtures.js';
export { seedRemoteFixture, type FixtureApi } from './client.js';
export { installE2EApiHeaders, installE2ENetworkMocks, runE2EScreens,
  type E2EBrowserPage, type E2EBrowserRoute, type E2ENetworkMock, type E2EScreen } from './browser.js';
export { traceE2EBrowser } from './tracing.js';
export { exerciseE2EFeedback, type E2EFeedbackPage } from './feedback.js';
