/**
 * Aviation Map Framework - Base Map Component
 */

import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { DEFAULT_TILE_LAYERS } from '../constants';
import 'leaflet/dist/leaflet.css';

export interface BaseMapProps {
  /**
   * Center position of the map [lat, lon]
   */
  center: LatLngExpression;
  
  /**
   * Initial zoom level
   * @default 9
   */
  zoom?: number;
  
  /**
   * Enable/disable scroll wheel zoom
   * @default true
   */
  scrollWheelZoom?: boolean;
  
  /**
   * Map container style
   */
  style?: React.CSSProperties;
  
  /**
   * Map container className
   */
  className?: string;
  
  /**
   * Tile layer to use
   * @default 'openStreetMap'
   */
  tileLayer?: 'openStreetMap' | 'openTopoMap' | 'satellite' | 'custom';
  
  /**
   * Custom tile layer URL (required if tileLayer is 'custom')
   */
  customTileUrl?: string;
  
  /**
   * Custom tile layer attribution (optional if tileLayer is 'custom')
   */
  customTileAttribution?: string;
  
  /**
   * Children components (markers, circles, polylines, etc.)
   */
  children?: React.ReactNode;
  
  /**
   * Min zoom level
   */
  minZoom?: number;
  
  /**
   * Max zoom level
   */
  maxZoom?: number;
  
  /**
   * Enable/disable zoom control
   * @default true
   */
  zoomControl?: boolean;
  
  /**
   * Enable/disable attribution control
   * @default true
   */
  attributionControl?: boolean;
}

/**
 * Base map component with sensible defaults for aviation applications
 * 
 * @example
 * ```tsx
 * <BaseMap 
 *   center={[37.7749, -122.4194]} 
 *   zoom={9}
 *   scrollWheelZoom={true}
 * >
 *   <Circle center={[37.7749, -122.4194]} radius={50000} />
 *   <Marker position={[37.7749, -122.4194]}>
 *     <Popup>San Francisco</Popup>
 *   </Marker>
 * </BaseMap>
 * ```
 */
export const BaseMap: React.FC<BaseMapProps> = ({
  center,
  zoom = 9,
  scrollWheelZoom = true,
  style = { height: '100%', width: '100%' },
  className,
  tileLayer = 'openStreetMap',
  customTileUrl,
  customTileAttribution,
  children,
  minZoom,
  maxZoom,
  zoomControl = true,
  attributionControl = true,
}) => {
  // Determine tile layer configuration
  const tileConfig = React.useMemo(() => {
    if (tileLayer === 'custom' && customTileUrl) {
      return {
        url: customTileUrl,
        attribution: customTileAttribution || '',
      };
    }
    // Type guard: ensure tileLayer is a valid key
    const validLayer = tileLayer === 'openStreetMap' || tileLayer === 'openTopoMap' || tileLayer === 'satellite'
      ? tileLayer
      : 'openStreetMap';
    return DEFAULT_TILE_LAYERS[validLayer];
  }, [tileLayer, customTileUrl, customTileAttribution]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={scrollWheelZoom}
      style={style}
      className={className}
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomControl={zoomControl}
      attributionControl={attributionControl}
    >
      <TileLayer
        url={tileConfig.url}
        attribution={tileConfig.attribution}
      />
      {children}
    </MapContainer>
  );
};
