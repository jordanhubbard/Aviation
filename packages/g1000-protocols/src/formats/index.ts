import type { FlightPlanModel } from "./flight-plan";

export {
  DEFAULT_FLIGHT_PLAN_SEGMENT,
  FLIGHT_PLAN_FORMATS,
  FLIGHT_PLAN_SPECS,
} from "./flight-plan";

// New format conversion utilities
export function convertFlightPlanToJson(flightPlan: FlightPlanModel): string {
  return JSON.stringify(flightPlan);
}

export function parseJsonToFlightPlan(json: string): FlightPlanModel {
  return JSON.parse(json) as FlightPlanModel;
}

export type {
  FlightPlanFormat,
  FlightPlanFormatSpec,
  FlightPlanModel,
  FplFlightPlan,
  FplWaypoint,
  GpxRoute,
  GpxRoutePoint,
  KmlCoordinate,
  KmlLineString,
} from "./flight-plan";
export {
  computeRouteBearingDeg,
  computeRouteDistanceNm,
  exportFlightPlan,
  exportToFpl,
  exportToGpx,
  exportToKml,
  importFlightPlan,
  importFromFpl,
  importFromGpx,
  importFromKml,
} from "./adapters";
export {
  CONFIG_SCHEMA_VERSION,
  isG1000Config,
} from "./config";
export type {
  DisplayConfig,
  G1000Config,
  NavigationConfig,
  SimulatorConfig,
} from "./config";
export {
  isTelemetryCaptureEnvelope,
  TELEMETRY_CAPTURE_VERSION,
} from "./telemetry";
export type {
  TelemetryCaptureEnvelope,
  TelemetryCaptureRecord,
} from "./telemetry";
