'use strict';

class HealthReportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'HealthReportError';
  }
}

const STATUS_ALIASES = Object.freeze({
  ok: 'ok',
  healthy: 'ok',
  up: 'ok',
  degraded: 'degraded',
  warning: 'degraded',
  unavailable: 'unavailable',
  unhealthy: 'unavailable',
  down: 'unavailable',
});

function normalizeHealthStatus(status) {
  const input = typeof status === 'string' ? status.trim().toLowerCase() : '';
  const normalized = STATUS_ALIASES[input];
  if (!normalized) {
    throw new HealthReportError(
      'health-status-invalid',
      `unsupported health status: ${String(status)}`,
    );
  }
  return normalized;
}

function createHealthReport(options = {}) {
  const status = normalizeHealthStatus(options.status ?? 'ok');
  const details = options.details ?? {};
  if (Object.prototype.hasOwnProperty.call(details, 'status')
      || Object.prototype.hasOwnProperty.call(details, 'service')) {
    throw new HealthReportError(
      'health-details-invalid',
      'health report details must not replace reserved fields',
    );
  }

  let service;
  if (options.service !== undefined) {
    if (typeof options.service !== 'string' || options.service.trim() === '') {
      throw new HealthReportError('health-service-invalid', 'service must be a non-empty string');
    }
    service = options.service.trim();
  }

  return {
    status,
    ...(service === undefined ? {} : { service }),
    ...details,
  };
}

module.exports = { HealthReportError, createHealthReport, normalizeHealthStatus };
