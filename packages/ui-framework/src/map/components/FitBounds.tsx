/**
 * Aviation Map Framework - FitBounds Component
 */

import React from 'react';
import type { LatLngExpression } from 'leaflet';
import { useFitBounds, type UseFitBoundsOptions } from '../hooks/useFitBounds';

export interface FitBoundsProps extends UseFitBoundsOptions {
  /**
   * Array of points to fit within the map bounds
   */
  points: LatLngExpression[];
}

/**
 * Component that automatically fits map bounds to a set of points
 * 
 * @example
 * ```tsx
 * <MapContainer center={[0, 0]} zoom={2}>
 *   <TileLayer url="..." />
 *   <FitBounds 
 *     points={[[37.7749, -122.4194], [40.7128, -74.0060]]} 
 *     padding={0.1}
 *   />
 * </MapContainer>
 * ```
 */
export const FitBounds: React.FC<FitBoundsProps> = ({ points, ...options }) => {
  useFitBounds(points, options);
  return null;
};
