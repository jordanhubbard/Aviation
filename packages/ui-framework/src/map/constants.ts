/**
 * Aviation Map Framework - Constants
 */

import type { FlightCategory, MapColors } from './types';

/**
 * Standard flight category colors
 * Following aviation standard color scheme
 */
export const CATEGORY_COLORS: Record<FlightCategory, MapColors> = {
  VFR: { fill: '#2e7d32', stroke: '#ffffff' },    // Green - Visual Flight Rules
  MVFR: { fill: '#1976d2', stroke: '#ffffff' },   // Blue - Marginal VFR
  IFR: { fill: '#d32f2f', stroke: '#ffffff' },    // Red - Instrument Flight Rules
  LIFR: { fill: '#8e24aa', stroke: '#ffffff' },   // Purple - Low IFR
  UNKNOWN: { fill: '#9e9e9e', stroke: '#ffffff' }, // Gray - Unknown
};

/**
 * Convert nautical miles to meters
 */
export const nmToMeters = (nm: number): number => nm * 1852;

/**
 * Convert meters to nautical miles
 */
export const metersToNm = (meters: number): number => meters / 1852;

/**
 * Default tile layer URLs
 */
export const DEFAULT_TILE_LAYERS = {
  openStreetMap: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  openTopoMap: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

/**
 * OpenWeatherMap layer types
 */
export const OPENWEATHER_LAYERS = {
  clouds: 'clouds_new',
  wind: 'wind_new',
  precipitation: 'precipitation_new',
  temperature: 'temp_new',
  pressure: 'pressure_new',
} as const;

export type WeatherOverlayType = keyof typeof OPENWEATHER_LAYERS;
