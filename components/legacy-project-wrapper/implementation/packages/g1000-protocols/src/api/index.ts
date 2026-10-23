import type {
  FlightPlanCreateRequest,
  FlightPlanResponse,
  FlightPlanUpdateRequest,
} from "./schema";

export { API_PROTOCOL_VERSION } from "./schema";

// New API client implementation
export class ApiClient {
  constructor(baseUrl: string) {
    // Initialize API client with base URL
  }

  async getFlightPlan(_id: string): Promise<FlightPlanResponse> {
    return { success: false, error: { code: "not_implemented", message: "getFlightPlan" } };
  }

  async createFlightPlan(_request: FlightPlanCreateRequest): Promise<FlightPlanResponse> {
    return { success: false, error: { code: "not_implemented", message: "createFlightPlan" } };
  }

  async updateFlightPlan(
    _id: string,
    _request: FlightPlanUpdateRequest
  ): Promise<FlightPlanResponse> {
    return { success: false, error: { code: "not_implemented", message: "updateFlightPlan" } };
  }

  async deleteFlightPlan(_id: string): Promise<void> {
    // Delete a flight plan by ID
  }
}
export type {
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
  FlightPlanListResponse,
  FlightPlanLoadRequest,
  FlightPlanResponse,
  FlightPlanSegment,
  FlightPlanSegmentType,
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
export {
  isAltitudeSetRequest,
  isApiError,
  isApiMetadata,
  isApiResponse,
  isAutopilotEngageRequest,
  isAutopilotModeRequest,
  isControlResponse,
  isControlState,
  isFlightPlan,
  isFlightPlanCreateRequest,
  isFlightPlanLeg,
  isFlightPlanLoadRequest,
  isFlightPlanSegment,
  isFlightPlanUpdateRequest,
  isFlightPlanWaypoint,
  isFlightState,
  isFlightStateResponse,
  isHeadingSetRequest,
  isNavigationState,
  isNavigationStateResponse,
  isSystemsState,
  isSystemsStateResponse,
} from "./validation";
