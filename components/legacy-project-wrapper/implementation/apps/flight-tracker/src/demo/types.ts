/**
 * Demo Flight Service Types
 * 
 * Shared types for the demo flight service modules.
 */

import { FlightState, PFDUpdate, NAVUpdate, SystemStatus } from '../data-publisher';

/**
 * Scenario category types
 */
export type ScenarioCategory = 'pattern' | 'approach' | 'cross-country' | 'emergency' | 'custom';

/**
 * Difficulty levels for training scenarios
 */
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * A single point in a recorded flight
 */
export interface FlightDataPoint {
  timestamp: number;
  flightState: FlightState;
  pfdData?: PFDUpdate;
  navData?: NAVUpdate;
  systemStatus?: SystemStatus;
}

/**
 * Waypoint definition for scenarios
 */
export interface Waypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  holdTime?: number;
}

/**
 * Weather conditions for scenarios
 */
export interface WeatherConditions {
  visibility: number;
  ceiling: number;
  windDirection: number;
  windSpeed: number;
  windGust?: number;
  precipitation?: 'none' | 'light' | 'moderate' | 'heavy';
  icing?: 'none' | 'light' | 'moderate' | 'severe';
  turbulence?: 'none' | 'light' | 'moderate' | 'severe';
}

/**
 * Scenario metadata
 */
export interface ScenarioMetadata {
  id: string;
  name: string;
  description: string;
  category: ScenarioCategory;
  difficulty: DifficultyLevel;
  duration: number;
  aircraft: string;
  departureAirport?: string;
  arrivalAirport?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

/**
 * Complete scenario definition
 */
export interface Scenario extends ScenarioMetadata {
  waypoints: Waypoint[];
  weather: WeatherConditions;
  dataPoints: FlightDataPoint[];
}

/**
 * Recording session state
 */
export interface RecordingSession {
  id: string;
  startTime: number;
  isRecording: boolean;
  dataPoints: FlightDataPoint[];
  metadata: Partial<ScenarioMetadata>;
}

/**
 * Playback state
 */
export interface PlaybackState {
  scenarioId: string;
  isPlaying: boolean;
  isPaused: boolean;
  currentIndex: number;
  playbackSpeed: number;
  startTime: number;
  elapsedTime: number;
}

/**
 * Scenario filter options
 */
export interface ScenarioFilter {
  category?: ScenarioCategory;
  difficulty?: DifficultyLevel;
  tags?: string[];
  searchQuery?: string;
  minDuration?: number;
  maxDuration?: number;
}

/**
 * API response for scenario list
 */
export interface ScenarioListResponse {
  scenarios: ScenarioMetadata[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Recording options
 */
export interface RecordingOptions {
  captureInterval: number;
  includePFD: boolean;
  includeNAV: boolean;
  includeSystemStatus: boolean;
  maxDuration: number;
}

/**
 * Playback options
 */
export interface PlaybackOptions {
  speed: number;
  loop: boolean;
  startFromBeginning: boolean;
}
