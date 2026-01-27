import type {
  TelemetryAudioPanel,
  TelemetryAutopilot,
  TelemetrySnapshot,
  TelemetryTargets,
  TelemetryTransponder,
} from "../websocket/telemetry";

export const API_PROTOCOL_VERSION = "1.0.0";

export interface ApiMetadata {
  timestamp: string;
  requestId?: string;
  version?: string;
}

export interface ApiError {
  code: string;
  message: string;
  detail?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ApiMetadata;
}

export type FlightState = TelemetrySnapshot;

export type WaypointType =
  | "airport"
  | "navaid"
  | "intersection"
  | "user"
  | "airway"
  | "procedure";

export interface FlightPlanWaypoint {
  id: string;
  type: WaypointType;
  name?: string;
  latitude_deg?: number;
  longitude_deg?: number;
  altitude_ft?: number;
}

export interface FlightPlanLeg {
  sequence: number;
  waypoint: FlightPlanWaypoint;
  course_deg?: number;
  distance_nm?: number;
  altitude_constraint_ft?: number;
  speed_constraint_kt?: number;
}

export type FlightPlanSegmentType =
  | "departure"
  | "enroute"
  | "arrival"
  | "approach"
  | "missed";

export interface FlightPlanSegment {
  type: FlightPlanSegmentType;
  legs: FlightPlanLeg[];
}

export interface FlightPlan {
  id: string;
  name?: string;
  origin?: string;
  destination?: string;
  alternate?: string;
  segments: FlightPlanSegment[];
  active_leg_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface NavigationState {
  active_flight_plan?: FlightPlan;
  active_leg_index?: number;
  nav_mode?: string;
  desired_track_deg?: number;
  bearing_to_next_deg?: number;
  distance_to_next_nm?: number;
  time_to_next_sec?: number;
  cross_track_error_nm?: number;
}

export interface SystemsState {
  autopilot?: TelemetryAutopilot;
  audio_panel?: TelemetryAudioPanel;
  transponder?: TelemetryTransponder;
  targets?: TelemetryTargets;
}

export interface ControlState extends SystemsState {
  flight_plan?: FlightPlan;
}

export interface AutopilotEngageRequest {
  master_on: boolean;
}

export interface AutopilotModeRequest {
  lateral_mode?: string;
  vertical_mode?: string;
  target_vertical_speed_fpm?: number;
}

export interface HeadingSetRequest {
  heading_deg: number;
}

export interface AltitudeSetRequest {
  altitude_ft: number;
}

export interface FlightPlanLoadRequest {
  flight_plan_id?: string;
  flight_plan?: FlightPlan;
  activate?: boolean;
}

export interface FlightPlanCreateRequest {
  name?: string;
  origin: string;
  destination: string;
  alternate?: string;
  segments?: FlightPlanSegment[];
}

export interface FlightPlanUpdateRequest {
  name?: string;
  origin?: string;
  destination?: string;
  alternate?: string;
  segments?: FlightPlanSegment[];
  active_leg_index?: number;
}

export type FlightStateResponse = ApiResponse<FlightState>;
export type NavigationStateResponse = ApiResponse<NavigationState>;
export type SystemsStateResponse = ApiResponse<SystemsState>;
export type ControlResponse = ApiResponse<ControlState>;
export type FlightPlanResponse = ApiResponse<FlightPlan>;
export type FlightPlanListResponse = ApiResponse<FlightPlan[]>;
