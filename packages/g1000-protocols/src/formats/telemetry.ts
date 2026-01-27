import type { TelemetrySnapshot } from "../websocket/telemetry";

export const TELEMETRY_CAPTURE_VERSION = "1.0.0";

export interface TelemetryCaptureRecord {
  timestamp: string;
  frame: TelemetrySnapshot;
}

export interface TelemetryCaptureEnvelope {
  version: string;
  created_at: string;
  source?: string;
  records: TelemetryCaptureRecord[];
}

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isTelemetryCaptureRecord = (
  value: unknown,
): value is TelemetryCaptureRecord =>
  isRecord(value)
  && isString(value.timestamp)
  && isRecord(value.frame);

export const isTelemetryCaptureEnvelope = (
  value: unknown,
): value is TelemetryCaptureEnvelope =>
  isRecord(value)
  && isString(value.version)
  && isString(value.created_at)
  && (value.source === undefined || isString(value.source))
  && Array.isArray(value.records)
  && value.records.every(isTelemetryCaptureRecord);
