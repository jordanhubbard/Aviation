/**
 * Aviation Map Framework - Terrain Renderer Component
 */

import React from 'react';
import { TileLayer } from 'react-leaflet';

export interface TerrainRendererProps {
  /**
   * URL template for the terrain tiles
   */
  tileUrl: string;

  /**
   * Overlay opacity (0-1)
   * @default 0.7
   */
  opacity?: number;

  /**
   * Whether the terrain overlay is enabled
   * @default true
   */
  enabled?: boolean;
}

/**
 * Terrain renderer component for displaying terrain layers
 *
 * @example
 * ```tsx
 * <MapRenderer 
 *   center={[37.7749, -122.4194]} 
 *   zoom={9} 
 *   tileUrl="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
 * >
 *   <TerrainRenderer 
 *     tileUrl="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
 *     opacity={0.5}
 *   />
 * </MapRenderer>
 * ```
 */
export const TerrainRenderer: React.FC<TerrainRendererProps> = ({
  tileUrl,
  opacity = 0.7,
  enabled = true,
}) => {
  if (!enabled) {
    return null;
  }

  return (
    <TileLayer
      url={tileUrl}
      opacity={opacity}
    />
  );
};
