/**
 * Aviation Map Framework - Wind Barb Marker Component
 */

import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { createWindBarbIcon } from '../utils/icons';
import type { FlightCategory } from '../types';

export interface WindBarbMarkerProps {
  /**
   * Position of the wind barb [lat, lon]
   */
  position: LatLngExpression;
  
  /**
   * Wind direction in degrees (meteorological: direction wind is coming FROM)
   */
  direction: number;
  
  /**
   * Wind speed in knots
   */
  speedKts: number;
  
  /**
   * Flight category for color coding (optional)
   */
  category?: FlightCategory;
  
  /**
   * Size of the wind barb icon
   * @default 40
   */
  size?: number;
  
  /**
   * Label for the popup (e.g., airport code)
   */
  label?: string;
  
  /**
   * Additional popup content
   */
  popupContent?: React.ReactNode;
}

/**
 * Wind barb marker component for displaying wind data on map
 * 
 * @example
 * ```tsx
 * <BaseMap center={[37.7749, -122.4194]} zoom={9}>
 *   <WindBarbMarker
 *     position={[37.7749, -122.4194]}
 *     direction={270}
 *     speedKts={15}
 *     category="VFR"
 *     label="KSFO"
 *   />
 * </BaseMap>
 * ```
 */
export const WindBarbMarker: React.FC<WindBarbMarkerProps> = ({
  position,
  direction,
  speedKts,
  category,
  size = 40,
  label,
  popupContent,
}) => {
  const icon = React.useMemo(
    () => createWindBarbIcon(direction, speedKts, category, size),
    [direction, speedKts, category, size]
  );

  return (
    <Marker position={position} icon={icon}>
      {(label || popupContent) && (
        <Popup>
          {label && `${label}: `}
          Wind: {Math.round(speedKts)} kt @ {direction}°
          {popupContent}
        </Popup>
      )}
    </Marker>
  );
};
