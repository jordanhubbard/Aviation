import type {
  AltitudeSetRequest,
  ApiError,
  ApiMetadata,
  ApiResponse,
  AutopilotEngageRequest,
  AutopilotModeRequest,
  ControlResponse,
  ControlState,
  FlightPlan,
  FlightPlanCreateRequest,
  FlightPlanLeg,
  FlightPlanLoadRequest,
  FlightPlanSegment,
  FlightPlanUpdateRequest,
  FlightPlanWaypoint,
  FlightState,
  FlightStateResponse,
  HeadingSetRequest,
  NavigationState,
  NavigationStateResponse,
  SystemsState,
  SystemsStateResponse,
  WaypointType,
} from "./schema";
import { isTelemetrySnapshot } from "../websocket/telemetry";

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || isString(value);

const isOptionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || isNumber(value);

const isOptionalBoolean = (value: unknown): value is boolean | undefined =>
  value === undefined || isBoolean(value);

const waypointTypes: WaypointType[] = [
  "airport",
  "navaid",
  "intersection",
  "user",
  "airway",
  "procedure",
];

const segmentTypes = ["departure", "enroute", "arrival", "approach", "missed"];

const isWaypointType = (value: unknown): value is WaypointType =>
  isString(value) && waypointTypes.includes(value as WaypointType);

const isSegmentType = (value: unknown): value is FlightPlanSegment["type"] =>
  isString(value) && segmentTypes.includes(value);

export const isApiMetadata = (value: unknown): value is ApiMetadata =>
  isRecord(value)
  && isString(value.timestamp)
  && isOptionalString(value.requestId)
  && isOptionalString(value.version);

export const isApiError = (value: unknown): value is ApiError =>
  isRecord(value)
  && isString(value.code)
  && isString(value.message)
  && isOptionalString(value.detail);

export const isApiResponse = <T>(
  value: unknown,
  dataGuard: (data: unknown) => data is T,
): value is ApiResponse<T> => {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return false;
  }
  if (value.metadata !== undefined && !isApiMetadata(value.metadata)) {
    return false;
  }
  if (value.success) {
    return value.data !== undefined && dataGuard(value.data);
  }
  return value.error !== undefined && isApiError(value.error);
};

export const isFlightPlanWaypoint = (
  value: unknown,
): value is FlightPlanWaypoint =>
  isRecord(value)
  && isString(value.id)
  && isWaypointType(value.type)
  && isOptionalString(value.name)
  && isOptionalNumber(value.latitude_deg)
  && isOptionalNumber(value.longitude_deg)
  && isOptionalNumber(value.altitude_ft);

export const isFlightPlanLeg = (value: unknown): value is FlightPlanLeg =>
  isRecord(value)
  && isNumber(value.sequence)
  && isFlightPlanWaypoint(value.waypoint)
  && isOptionalNumber(value.course_deg)
  && isOptionalNumber(value.distance_nm)
  && isOptionalNumber(value.altitude_constraint_ft)
  && isOptionalNumber(value.speed_constraint_kt);

export const isFlightPlanSegment = (
  value: unknown,
): value is FlightPlanSegment =>
  isRecord(value)
  && isSegmentType(value.type)
  && Array.isArray(value.legs)
  && value.legs.every(isFlightPlanLeg);

export const isFlightPlan = (value: unknown): value is FlightPlan =>
  isRecord(value)
  && isString(value.id)
  && isOptionalString(value.name)
  && isOptionalString(value.origin)
  && isOptionalString(value.destination)
  && isOptionalString(value.alternate)
  && Array.isArray(value.segments)
  && value.segments.every(isFlightPlanSegment)
  && isOptionalNumber(value.active_leg_index)
  && isOptionalString(value.created_at)
  && isOptionalString(value.updated_at);

const isAutopilot = (value: unknown): value is ControlState["autopilot"] =>
  isRecord(value)
  && isBoolean(value.master_on)
  && isString(value.lateral_mode)
  && isString(value.vertical_mode)
  && isString(value.lateral_armed)
  && isString(value.vertical_armed)
  && isNumber(value.target_vertical_speed_fpm)
  && isBoolean(value.bank_limit_active)
  && isBoolean(value.pitch_limit_active)
  && isString(value.disconnect_reason);

const isAudioPanel = (value: unknown): value is ControlState["audio_panel"] =>
  isRecord(value)
  && isBoolean(value.com1_enabled)
  && isBoolean(value.com2_enabled)
  && isBoolean(value.nav1_enabled)
  && isBoolean(value.nav2_enabled)
  && isBoolean(value.adf_enabled)
  && isBoolean(value.marker_enabled)
  && isBoolean(value.speaker_enabled)
  && isBoolean(value.headphone_enabled)
  && isNumber(value.com1_volume)
  && isNumber(value.com2_volume)
  && isNumber(value.nav1_volume)
  && isNumber(value.nav2_volume)
  && isNumber(value.adf_volume)
  && isNumber(value.marker_volume)
  && isOptionalNumber(value.adf_audio_level)
  && isOptionalNumber(value.marker_audio_level)
  && isOptionalBoolean(value.marker_outer_active)
  && isOptionalBoolean(value.marker_middle_active)
  && isOptionalBoolean(value.marker_inner_active);

const isTransponder = (value: unknown): value is ControlState["transponder"] =>
  isRecord(value)
  && isString(value.mode)
  && isString(value.squawk_code)
  && isBoolean(value.ident_active)
  && isNumber(value.ident_remaining_sec);

const isTargets = (value: unknown): value is ControlState["targets"] =>
  isRecord(value)
  && isNumber(value.heading_deg)
  && isNumber(value.altitude_ft)
  && isNumber(value.airspeed_kt);

export const isSystemsState = (value: unknown): value is SystemsState =>
  isRecord(value)
  && (value.autopilot === undefined || isAutopilot(value.autopilot))
  && (value.audio_panel === undefined || isAudioPanel(value.audio_panel))
  && (value.transponder === undefined || isTransponder(value.transponder))
  && (value.targets === undefined || isTargets(value.targets));

export const isControlState = (value: unknown): value is ControlState =>
  isSystemsState(value)
  && ((value as ControlState).flight_plan === undefined
    || isFlightPlan((value as ControlState).flight_plan));

export const isNavigationState = (value: unknown): value is NavigationState =>
  isRecord(value)
  && (value.active_flight_plan === undefined
    || isFlightPlan(value.active_flight_plan))
  && isOptionalNumber(value.active_leg_index)
  && isOptionalString(value.nav_mode)
  && isOptionalNumber(value.desired_track_deg)
  && isOptionalNumber(value.bearing_to_next_deg)
  && isOptionalNumber(value.distance_to_next_nm)
  && isOptionalNumber(value.time_to_next_sec)
  && isOptionalNumber(value.cross_track_error_nm);

export const isFlightState = (value: unknown): value is FlightState =>
  isTelemetrySnapshot(value);

export const isAutopilotEngageRequest = (
  value: unknown,
): value is AutopilotEngageRequest =>
  isRecord(value) && isBoolean(value.master_on);

export const isAutopilotModeRequest = (
  value: unknown,
): value is AutopilotModeRequest =>
  isRecord(value)
  && isOptionalString(value.lateral_mode)
  && isOptionalString(value.vertical_mode)
  && isOptionalNumber(value.target_vertical_speed_fpm);

export const isHeadingSetRequest = (
  value: unknown,
): value is HeadingSetRequest =>
  isRecord(value) && isNumber(value.heading_deg);

export const isAltitudeSetRequest = (
  value: unknown,
): value is AltitudeSetRequest =>
  isRecord(value) && isNumber(value.altitude_ft);

export const isFlightPlanLoadRequest = (
  value: unknown,
): value is FlightPlanLoadRequest =>
  isRecord(value)
  && (value.flight_plan_id === undefined || isString(value.flight_plan_id))
  && (value.flight_plan === undefined || isFlightPlan(value.flight_plan))
  && isOptionalBoolean(value.activate)
  && (value.flight_plan_id !== undefined || value.flight_plan !== undefined);

export const isFlightPlanCreateRequest = (
  value: unknown,
): value is FlightPlanCreateRequest =>
  isRecord(value)
  && isString(value.origin)
  && isString(value.destination)
  && isOptionalString(value.name)
  && isOptionalString(value.alternate)
  && (value.segments === undefined
    || (Array.isArray(value.segments)
      && value.segments.every(isFlightPlanSegment)));

export const isFlightPlanUpdateRequest = (
  value: unknown,
): value is FlightPlanUpdateRequest =>
  isRecord(value)
  && isOptionalString(value.name)
  && isOptionalString(value.origin)
  && isOptionalString(value.destination)
  && isOptionalString(value.alternate)
  && isOptionalNumber(value.active_leg_index)
  && (value.segments === undefined
    || (Array.isArray(value.segments)
      && value.segments.every(isFlightPlanSegment)));

export const isFlightStateResponse = (
  value: unknown,
): value is FlightStateResponse => isApiResponse(value, isFlightState);

export const isNavigationStateResponse = (
  value: unknown,
): value is NavigationStateResponse => isApiResponse(value, isNavigationState);

export const isSystemsStateResponse = (
  value: unknown,
): value is SystemsStateResponse => isApiResponse(value, isSystemsState);

export const isControlResponse = (
  value: unknown,
): value is ControlResponse => isApiResponse(value, isControlState);
