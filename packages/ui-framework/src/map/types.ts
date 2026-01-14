/**
 * Map Component Types
 * 
 * Shared types for aviation map components.
 * Extracted from flightplanner for shared use.
 */

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';

export interface MapPosition {
  latitude: number;
  longitude: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface AirportMarker {
  code: string;
  name?: string;
  position: MapPosition;
  category?: FlightCategory;
  distance_nm?: number;
}

export interface WeatherMarker {
  position: MapPosition;
  wind_direction?: number;
  wind_speed_kt?: number;
  category?: FlightCategory;
  label?: string;
}

export interface RoutePoint {
  position: MapPosition;
  altitude_ft?: number;
  name?: string;
}

export interface MapColors {
  fill: string;
  stroke: string;
  opacity?: number;
}

export const FLIGHT_CATEGORY_COLORS: Record<FlightCategory, MapColors> = {
  VFR: { fill: '#2e7d32', stroke: '#ffffff', opacity: 0.95 },
  MVFR: { fill: '#1976d2', stroke: '#ffffff', opacity: 0.95 },
  IFR: { fill: '#d32f2f', stroke: '#ffffff', opacity: 0.95 },
  LIFR: { fill: '#8e24aa', stroke: '#ffffff', opacity: 0.95 },
  UNKNOWN: { fill: '#9e9e9e', stroke: '#ffffff', opacity: 0.5 },
};

export interface WeatherOverlay {
  enabled: boolean;
  opacity: number;
}

export type WeatherOverlayType = 'clouds' | 'wind' | 'precipitation' | 'temperature';

export type WeatherOverlays = Record<WeatherOverlayType, WeatherOverlay>;

export interface MapConfig {
  center: MapPosition;
  zoom: number;
  scrollWheelZoom?: boolean;
  minZoom?: number;
  maxZoom?: number;
}
