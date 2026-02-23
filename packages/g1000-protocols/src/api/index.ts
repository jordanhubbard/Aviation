export { API_PROTOCOL_VERSION } from "./schema";

// New API client implementation
export class ApiClient {
  constructor(baseUrl: string) {
    // Initialize API client with base URL
  }

  async getFlightPlan(id: string): Promise<FlightPlanResponse> {
    // Fetch flight plan by ID
  }

  async createFlightPlan(request: FlightPlanCreateRequest): Promise<FlightPlanResponse> {
    // Create a new flight plan
  }

  async updateFlightPlan(id: string, request: FlightPlanUpdateRequest): Promise<FlightPlanResponse> {
    // Update an existing flight plan
  }

  async deleteFlightPlan(id: string): Promise<void> {
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
