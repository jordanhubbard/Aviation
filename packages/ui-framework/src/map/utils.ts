/**
 * Map Utility Functions
 * 
 * Utility functions for map operations.
 * Extracted from flightplanner for shared use.
 */

import type { MapPosition, MapBounds } from './types';

/**
 * Convert nautical miles to meters
 */
export function nmToMeters(nm: number): number {
  return nm * 1852;
}

/**
 * Convert meters to nautical miles
 */
export function metersToNm(meters: number): number {
  return meters / 1852;
}

/**
 * Calculate map bounds from a center point and radius
 */
export function boundsFromRadius(
  center: MapPosition,
  radiusNm: number
): MapBounds {
  // Approximate: 1 NM ≈ 1/60 degree at equator
  const deltaLat = radiusNm / 60;
  const deltaLon = radiusNm / (60 * Math.cos((center.latitude * Math.PI) / 180));

  return {
    north: Math.min(90, center.latitude + deltaLat),
    south: Math.max(-90, center.latitude - deltaLat),
    east: Math.min(180, center.longitude + deltaLon),
    west: Math.max(-180, center.longitude - deltaLon),
  };
}

/**
 * Calculate map bounds from an array of positions
 */
export function boundsFromPositions(positions: MapPosition[]): MapBounds | null {
  if (positions.length === 0) {
    return null;
  }

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const pos of positions) {
    north = Math.max(north, pos.latitude);
    south = Math.min(south, pos.latitude);
    east = Math.max(east, pos.longitude);
    west = Math.min(west, pos.longitude);
  }

  return { north, south, east, west };
}

/**
 * Add padding to map bounds (percentage)
 */
export function padBounds(bounds: MapBounds, padding: number = 0.1): MapBounds {
  const latRange = bounds.north - bounds.south;
  const lonRange = bounds.east - bounds.west;

  const latPad = latRange * padding;
  const lonPad = lonRange * padding;

  return {
    north: Math.min(90, bounds.north + latPad),
    south: Math.max(-90, bounds.south - latPad),
    east: Math.min(180, bounds.east + lonPad),
    west: Math.max(-180, bounds.west - lonPad),
  };
}

/**
 * Check if a position is within bounds
 */
export function isInBounds(position: MapPosition, bounds: MapBounds): boolean {
  return (
    position.latitude >= bounds.south &&
    position.latitude <= bounds.north &&
    position.longitude >= bounds.west &&
    position.longitude <= bounds.east
  );
}

/**
 * Calculate center of bounds
 */
export function boundsCenter(bounds: MapBounds): MapPosition {
  return {
    latitude: (bounds.north + bounds.south) / 2,
    longitude: (bounds.east + bounds.west) / 2,
  };
}

/**
 * Format coordinates for display
 */
export function formatPosition(position: MapPosition, decimals: number = 4): string {
  const lat = position.latitude.toFixed(decimals);
  const lon = position.longitude.toFixed(decimals);
  const latDir = position.latitude >= 0 ? 'N' : 'S';
  const lonDir = position.longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(parseFloat(lat))}°${latDir}, ${Math.abs(parseFloat(lon))}°${lonDir}`;
}

/**
 * Generate OpenStreetMap tile URL
 */
export function osmTileUrl(z: number, x: number, y: number): string {
  const servers = ['a', 'b', 'c'];
  const server = servers[(x + y) % servers.length];
  return `https://${server}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/**
 * Generate OpenWeatherMap overlay tile URL
 */
export function owmOverlayUrl(
  layer: 'clouds' | 'wind' | 'precipitation' | 'temperature',
  z: number,
  x: number,
  y: number,
  apiKey: string
): string {
  const layerMap = {
    clouds: 'clouds_new',
    wind: 'wind_new',
    precipitation: 'precipitation_new',
    temperature: 'temp_new',
  };

  const layerName = layerMap[layer];
  return `https://tile.openweathermap.org/map/${layerName}/${z}/${x}/${y}.png?appid=${apiKey}`;
}
