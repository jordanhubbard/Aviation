/** Provider-neutral service-health report semantics. */

export type HealthStatus = 'ok' | 'degraded' | 'unavailable';

export interface HealthReportOptions {
  status?: string;
  service?: string;
  details?: Readonly<Record<string, unknown>>;
}

export type HealthReport = Record<string, unknown> & {
  status: HealthStatus;
  service?: string;
};

/** Stable fail-closed error emitted by portable health operations. */
export class HealthReportError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'HealthReportError';
  }
}

const STATUS_ALIASES: Readonly<Record<string, HealthStatus>> = {
  ok: 'ok',
  healthy: 'ok',
  up: 'ok',
  degraded: 'degraded',
  warning: 'degraded',
  unavailable: 'unavailable',
  unhealthy: 'unavailable',
  down: 'unavailable',
};

/** Normalize a canonical health status or supported application alias. */
export function normalizeHealthStatus(status: unknown): HealthStatus {
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

/** Build a deterministic common report while preserving adapter-owned details. */
export function createHealthReport(options: HealthReportOptions = {}): HealthReport {
  const status = normalizeHealthStatus(options.status ?? 'ok');
  const details = options.details ?? {};
  if (Object.prototype.hasOwnProperty.call(details, 'status')
      || Object.prototype.hasOwnProperty.call(details, 'service')) {
    throw new HealthReportError(
      'health-details-invalid',
      'health report details must not replace reserved fields',
    );
  }

  let service: string | undefined;
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
