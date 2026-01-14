/**
 * Aviation Map Framework - Type Definitions
 * Shared types for map components
 */

import type { LatLngExpression, DivIcon, IconOptions, PathOptions } from 'leaflet';

/**
 * Flight category for weather-based color coding
 */
export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';

/**
 * Color scheme for flight categories
 */
export interface FlightCategoryColors {
  fill: string;
  stroke: string;
}

/**
 * Geographic point with optional metadata
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  label?: string;
  metadata?: Record<string, any>;
}

/**
 * Map marker configuration
 */
export interface MapMarker {
  position: LatLngExpression;
  icon?: DivIcon | L.Icon;
  popup?: React.ReactNode;
  tooltip?: string;
  metadata?: Record<string, any>;
}

/**
 * Circle marker configuration
 */
export interface CircleMarkerConfig {
  center: LatLngExpression;
  radius: number;
  pathOptions?: PathOptions;
  popup?: React.ReactNode;
  tooltip?: string;
}

/**
 * Polyline configuration
 */
export interface PolylineConfig {
  positions: LatLngExpression[];
  pathOptions?: PathOptions;
  popup?: React.ReactNode;
}

/**
 * Map overlay configuration
 */
export interface MapOverlay {
  enabled: boolean;
  opacity: number;
  url?: string;
  attribution?: string;
}

/**
 * Wind barb configuration
 */
export interface WindBarbConfig {
  direction: number;
  speedKts: number;
  category?: FlightCategory;
  size?: number;
  backgroundFill?: string;
  backgroundStroke?: string;
}

/**
 * Base map configuration
 */
export interface MapConfig {
  center: LatLngExpression;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  scrollWheelZoom?: boolean;
  dragging?: boolean;
  zoomControl?: boolean;
  attributionControl?: boolean;
}
