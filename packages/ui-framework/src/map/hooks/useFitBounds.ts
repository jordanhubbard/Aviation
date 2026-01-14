/**
 * Aviation Map Framework - useFitBounds Hook
 */

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';

export interface UseFitBoundsOptions {
  /**
   * Padding factor (0-1) to add around the bounds
   * @default 0.25
   */
  padding?: number;
  
  /**
   * Whether to animate the transition
   * @default true
   */
  animate?: boolean;
  
  /**
   * Maximum zoom level
   */
  maxZoom?: number;
}

/**
 * Hook to automatically fit map bounds to a set of points
 * 
 * @param points Array of [lat, lon] coordinates
 * @param options Fit bounds options
 * 
 * @example
 * ```tsx
 * function MyMap() {
 *   const points: [number, number][] = [[37.7749, -122.4194], [40.7128, -74.0060]];
 *   
 *   return (
 *     <MapContainer>
 *       <FitBounds points={points} padding={0.1} />
 *     </MapContainer>
 *   );
 * }
 * ```
 */
export function useFitBounds(
  points: LatLngExpression[],
  options: UseFitBoundsOptions = {}
): void {
  const map = useMap();
  const { padding = 0.25, animate = true, maxZoom } = options;

  useEffect(() => {
    if (!points || points.length < 2) return;

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(padding), {
      animate,
      maxZoom,
    });
  }, [map, points, padding, animate, maxZoom]);
}
