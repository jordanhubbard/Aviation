'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  HealthReportError,
  createHealthReport,
  normalizeHealthStatus,
} = require('../src/index.js');

const normalization = [
  ['ok', 'ok'], [' healthy ', 'ok'], ['UP', 'ok'],
  ['degraded', 'degraded'], ['Warning', 'degraded'],
  ['unavailable', 'unavailable'], ['unhealthy', 'unavailable'], ['DOWN', 'unavailable'],
];

for (const [input, expected] of normalization) {
  test(`normalizes ${JSON.stringify(input)}`, () => {
    assert.equal(normalizeHealthStatus(input), expected);
  });
}

for (const input of ['', 'unknown', 'starting']) {
  test(`rejects ${JSON.stringify(input)}`, () => {
    assert.throws(() => normalizeHealthStatus(input),
      (error) => error instanceof HealthReportError && error.code === 'health-status-invalid');
  });
}

test('constructs reports without mutation', () => {
  const input = { status: 'warning', service: ' flight-planner ', details: { retryable: true } };
  const before = structuredClone(input);
  assert.deepEqual(createHealthReport(input), {
    status: 'degraded', service: 'flight-planner', retryable: true,
  });
  assert.deepEqual(input, before);
});

for (const [input, code] of [
  [{ service: '  ' }, 'health-service-invalid'],
  [{ details: { status: 'ok' } }, 'health-details-invalid'],
  [{ details: { service: 'other' } }, 'health-details-invalid'],
  [{ status: 'starting' }, 'health-status-invalid'],
]) {
  test(`rejects report with ${code}`, () => {
    assert.throws(() => createHealthReport(input),
      (error) => error instanceof HealthReportError && error.code === code);
  });
}
