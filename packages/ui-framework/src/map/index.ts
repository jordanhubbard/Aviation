/**
 * Aviation Map Framework
 * Reusable map components and utilities for aviation applications
 */

// Types
export type {
  FlightCategory,
  FlightCategoryColors,
  GeoPoint,
  MapMarker,
  CircleMarkerConfig,
  PolylineConfig,
  MapOverlay,
  WindBarbConfig,
  MapConfig,
} from './types';

// Constants
export {
  CATEGORY_COLORS,
  nmToMeters,
  metersToNm,
  DEFAULT_TILE_LAYERS,
  OPENWEATHER_LAYERS,
  type WeatherOverlayType,
} from './constants';

// Components
export {
  BaseMap,
  type BaseMapProps,
  FitBounds,
  type FitBoundsProps,
  WeatherOverlay,
  type WeatherOverlayProps,
  WindBarbMarker,
  type WindBarbMarkerProps,
} from './components';

// Hooks
export {
  useFitBounds,
  type UseFitBoundsOptions,
} from './hooks';

// Utilities
export {
  windBarbSvg,
  createWindBarbIcon,
  createCircleIcon,
  createAirplaneIcon,
  toFlightCategory,
} from './utils';

// Re-export commonly used leaflet and react-leaflet components
export {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  Circle,
  CircleMarker,
  Polyline,
  Polygon,
  Rectangle,
  useMap,
  useMapEvents,
} from 'react-leaflet';

export type {
  LatLngExpression,
  LatLng,
  LatLngBounds,
  Map as LeafletMap,
  Icon,
  DivIcon,
  PathOptions,
} from 'leaflet';
