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

export class HealthReportError extends Error {
  readonly code: string;
  constructor(code: string, message: string);
}

export function normalizeHealthStatus(status: unknown): HealthStatus;
export function createHealthReport(options?: HealthReportOptions): HealthReport;
