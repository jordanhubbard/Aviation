/**
 * Aviation Map Components and Utilities
 * 
 * Provides types, utilities, and helpers for building aviation maps.
 * Extracted from flightplanner for shared use across aviation apps.
 * 
 * @module @aviation/ui-framework/map
 * 
 * @example
 * ```typescript
 * import { FLIGHT_CATEGORY_COLORS, windBarbSvg, boundsFromRadius } from '@aviation/ui-framework/map';
 * 
 * // Get colors for flight category
 * const colors = FLIGHT_CATEGORY_COLORS['VFR'];
 * 
 * // Generate wind barb SVG
 * const svg = windBarbSvg(270, 15, {
 *   backgroundFill: colors.fill,
 *   backgroundStroke: colors.stroke,
 * });
 * 
 * // Calculate map bounds
 * const bounds = boundsFromRadius({ latitude: 37.6213, longitude: -122.3790 }, 50);
 * ```
 */

// Types
export type {
  FlightCategory,
  MapPosition,
  MapBounds,
  AirportMarker,
  WeatherMarker,
  RoutePoint,
  MapColors,
  WeatherOverlay,
  WeatherOverlayType,
  WeatherOverlays,
  MapConfig,
} from './types';

export { FLIGHT_CATEGORY_COLORS } from './types';

// Utilities
export {
  nmToMeters,
  metersToNm,
  boundsFromRadius,
  boundsFromPositions,
  padBounds,
  isInBounds,
  boundsCenter,
  formatPosition,
  osmTileUrl,
  owmOverlayUrl,
} from './utils';

// Wind barbs
export { windBarbSvg, windBarbDataUrl, type WindBarbOptions } from './windBarb';
