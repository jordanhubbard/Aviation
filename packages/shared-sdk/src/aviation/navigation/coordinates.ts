/**
 * Coordinate Utilities for Aviation
 * 
 * Provides coordinate validation, normalization, and conversion utilities.
 */

/**
 * Coordinate pair [latitude, longitude]
 */
export type Coordinate = [number, number];

/**
 * Validate latitude value
 * 
 * @param lat Latitude in degrees
 * @returns True if valid
 */
export function isValidLatitude(lat: number): boolean {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude value
 * 
 * @param lon Longitude in degrees
 * @returns True if valid
 */
export function isValidLongitude(lon: number): boolean {
  return typeof lon === 'number' && !isNaN(lon) && lon >= -180 && lon <= 180;
}

/**
 * Validate coordinate pair
 * 
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @returns True if valid
 */
export function isValidCoordinate(lat: number, lon: number): boolean {
  return isValidLatitude(lat) && isValidLongitude(lon);
}

/**
 * Normalize latitude to -90 to 90 range
 * 
 * @param lat Latitude in degrees
 * @returns Normalized latitude
 */
export function normalizeLatitude(lat: number): number {
  // Clamp to valid range
  return Math.max(-90, Math.min(90, lat));
}

/**
 * Normalize longitude to -180 to 180 range
 * 
 * @param lon Longitude in degrees
 * @returns Normalized longitude
 */
export function normalizeLongitude(lon: number): number {
  let normalized = ((lon + 180) % 360);
  if (normalized < 0) normalized += 360;
  return normalized - 180;
}

/**
 * Normalize coordinate pair
 * 
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @returns Normalized [latitude, longitude]
 */
export function normalizeCoordinate(lat: number, lon: number): Coordinate {
  return [normalizeLatitude(lat), normalizeLongitude(lon)];
}

/**
 * Parse decimal degrees from string
 * 
 * @param value String value (e.g., "37.6213", "-122.3790")
 * @returns Parsed number or null if invalid
 */
export function parseDecimalDegrees(value: string): number | null {
  const num = parseFloat(value.trim());
  return isNaN(num) ? null : num;
}

/**
 * Convert DMS (Degrees Minutes Seconds) to decimal degrees
 * 
 * @param degrees Degrees
 * @param minutes Minutes
 * @param seconds Seconds
 * @param direction Direction ('N', 'S', 'E', 'W')
 * @returns Decimal degrees
 * 
 * @example
 * ```typescript
 * // Convert 37°37'18"N to decimal
 * const lat = dmsToDecimal(37, 37, 18, 'N'); // 37.6217
 * ```
 */
export function dmsToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  direction: 'N' | 'S' | 'E' | 'W'
): number {
  const decimal = degrees + minutes / 60 + seconds / 3600;
  
  // Apply sign based on direction
  return (direction === 'S' || direction === 'W') ? -decimal : decimal;
}

/**
 * Convert decimal degrees to DMS
 * 
 * @param decimal Decimal degrees
 * @param isLatitude True for latitude, false for longitude
 * @returns Object with degrees, minutes, seconds, and direction
 */
export function decimalToDMS(
  decimal: number,
  isLatitude: boolean
): { degrees: number; minutes: number; seconds: number; direction: string } {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = (minutesDecimal - minutes) * 60;
  
  let direction: string;
  if (isLatitude) {
    direction = decimal >= 0 ? 'N' : 'S';
  } else {
    direction = decimal >= 0 ? 'E' : 'W';
  }
  
  return { degrees, minutes, seconds, direction };
}

/**
 * Format coordinate as DMS string
 * 
 * @param decimal Decimal degrees
 * @param isLatitude True for latitude, false for longitude
 * @returns Formatted string (e.g., "37°37'18\"N")
 */
export function formatDMS(decimal: number, isLatitude: boolean): string {
  const dms = decimalToDMS(decimal, isLatitude);
  return `${dms.degrees}°${dms.minutes}'${dms.seconds.toFixed(1)}"${dms.direction}`;
}

/**
 * Format coordinate pair as string
 * 
 * @param lat Latitude in decimal degrees
 * @param lon Longitude in decimal degrees
 * @param format Format: 'decimal' or 'dms'
 * @returns Formatted string
 */
export function formatCoordinate(
  lat: number,
  lon: number,
  format: 'decimal' | 'dms' = 'decimal'
): string {
  if (format === 'dms') {
    return `${formatDMS(lat, true)}, ${formatDMS(lon, false)}`;
  } else {
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }
}

/**
 * Calculate bounding box for a point with radius
 * 
 * @param lat Center latitude
 * @param lon Center longitude
 * @param radiusNM Radius in nautical miles
 * @returns Bounding box [minLat, minLon, maxLat, maxLon]
 */
export function boundingBox(
  lat: number,
  lon: number,
  radiusNM: number
): [number, number, number, number] {
  // Approximate: 1 NM ≈ 1/60 degree at equator
  // More accurate calculation would use haversine, but this is simpler
  const deltaLat = radiusNM / 60;
  const deltaLon = radiusNM / (60 * Math.cos(lat * Math.PI / 180));
  
  return [
    Math.max(-90, lat - deltaLat),
    Math.max(-180, lon - deltaLon),
    Math.min(90, lat + deltaLat),
    Math.min(180, lon + deltaLon),
  ];
}

/**
 * Check if a point is within a bounding box
 * 
 * @param lat Point latitude
 * @param lon Point longitude
 * @param bbox Bounding box [minLat, minLon, maxLat, maxLon]
 * @returns True if point is inside
 */
export function isInBoundingBox(
  lat: number,
  lon: number,
  bbox: [number, number, number, number]
): boolean {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}
