/**
 * Aviation Map Framework - Map Renderer Component
 */

import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';

export interface MapRendererProps {
  /**
   * Initial center of the map
   */
  center: [number, number];

  /**
   * Initial zoom level
   */
  zoom: number;

  /**
   * URL template for the map tiles
   */
  tileUrl: string;

  /**
   * Overlay components to render on the map
   */
  overlays?: React.ReactNode;
}

/**
 * Map renderer component for displaying a map with optional overlays
 *
 * @example
 * ```tsx
 * <MapRenderer 
 *   center={[37.7749, -122.4194]} 
 *   zoom={9} 
 *   tileUrl="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
 * >
 *   <WeatherOverlay 
 *     type="clouds" 
 *     apiKey={process.env.OPENWEATHERMAP_API_KEY} 
 *     opacity={0.5}
 *   />
 * </MapRenderer>
 * ```
 */
export const MapRenderer: React.FC<MapRendererProps> = ({
  center,
  zoom,
  tileUrl,
  overlays,
}) => {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
      <TileLayer url={tileUrl} />
      {overlays}
    </MapContainer>
  );
};
