/**
 * Aviation Map Framework - Weather Overlay Component
 */

import React from 'react';
import { TileLayer } from 'react-leaflet';
import { OPENWEATHER_LAYERS, type WeatherOverlayType } from '../constants';

export interface WeatherOverlayProps {
  /**
   * Type of weather overlay
   */
  type: WeatherOverlayType;
  
  /**
   * OpenWeatherMap API key
   */
  apiKey: string;
  
  /**
   * Overlay opacity (0-1)
   * @default 0.6
   */
  opacity?: number;
  
  /**
   * Whether the overlay is enabled
   * @default true
   */
  enabled?: boolean;
}

/**
 * Weather overlay component for displaying OpenWeatherMap layers
 * 
 * @example
 * ```tsx
 * <BaseMap center={[37.7749, -122.4194]} zoom={9}>
 *   <WeatherOverlay 
 *     type="clouds" 
 *     apiKey={process.env.OPENWEATHERMAP_API_KEY} 
 *     opacity={0.5}
 *   />
 *   <WeatherOverlay 
 *     type="precipitation" 
 *     apiKey={process.env.OPENWEATHERMAP_API_KEY} 
 *   />
 * </BaseMap>
 * ```
 */
export const WeatherOverlay: React.FC<WeatherOverlayProps> = ({
  type,
  apiKey,
  opacity = 0.6,
  enabled = true,
}) => {
  if (!enabled || !apiKey) {
    return null;
  }

  const layer = OPENWEATHER_LAYERS[type];
  const url = `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${apiKey}`;

  return (
    <TileLayer
      url={url}
      opacity={opacity}
    />
  );
};
