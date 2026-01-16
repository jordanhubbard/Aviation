# Map Integration Extraction Implementation Spec

**Bead:** [Aviation-r2l] Extract map integration patterns to @aviation/ui-framework
**Priority:** P0 - MVP Blocker
**Effort:** 3-4 days
**Dependencies:** None (but will benefit from Aviation-o2d airports, Aviation-ywm navigation)

---

## Overview

Extract Leaflet map integration patterns from flight-planner into reusable UI framework components, including base map, markers, clustering, polylines, route drawing, and controls.

### Current Implementation

**Location:** `apps/flight-planner/frontend/src/components/`
- `MapComponent.tsx` (~200 lines) - Base map component
- `FlightMap.tsx` (~150 lines) - Flight-specific map features
- `RouteVisualization.tsx` (~100 lines) - Route drawing

**Dependencies:**
- `leaflet` - Core mapping library
- `react-leaflet` - React bindings
- `leaflet.markercluster` - Marker clustering

**Map Tiles:**
- OpenStreetMap (free, no API key)
- Stadia Maps (alternative, API key required)

---

## Target Implementation

### Package Structure

```
packages/ui-framework/
├── src/map/
│   ├── index.ts                    # Main exports
│   ├── BaseMap.tsx                 # Base map component
│   ├── Marker.tsx                  # Marker component
│   ├── MarkerCluster.tsx           # Marker clustering
│   ├── Polyline.tsx                # Polyline/route drawing
│   ├── Controls.tsx                # Map controls
│   ├── useMapState.ts              # Map state hook
│   ├── useMarkerClick.ts           # Marker interaction hook
│   ├── types.ts                    # Type definitions
│   ├── BaseMap.test.tsx            # Tests
│   ├── Marker.test.tsx
│   └── MarkerCluster.test.tsx
├── styles/
│   └── map.css                     # Map styles
└── public/
    └── marker-icons/               # Marker icon assets
```

---

## React/TypeScript API Design

### Core Types

```typescript
// packages/ui-framework/src/map/types.ts

export interface MapPosition {
  latitude: number;
  longitude: number;
  zoom?: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MarkerData {
  id: string | number;
  position: {
    latitude: number;
    longitude: number;
  };
  title?: string;
  subtitle?: string;
  icon?: MarkerIcon;
  color?: string;
  metadata?: Record<string, any>;
}

export interface MarkerIcon {
  type: 'default' | 'airport' | 'accident' | 'waypoint' | 'custom';
  url?: string;
  size?: [number, number];
  anchor?: [number, number];
}

export interface PolylineData {
  id: string | number;
  coordinates: Array<{ latitude: number; longitude: number }>;
  color?: string;
  weight?: number;
  opacity?: number;
  dashed?: boolean;
}

export interface MapConfig {
  center?: MapPosition;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  scrollWheelZoom?: boolean;
  dragging?: boolean;
  touchZoom?: boolean;
  doubleClickZoom?: boolean;
  zoomControl?: boolean;
  attributionControl?: boolean;
}

export interface ClusterConfig {
  enabled: boolean;
  maxClusterRadius?: number;
  disableClusteringAtZoom?: number;
  spiderfyOnMaxZoom?: boolean;
  showCoverageOnHover?: boolean;
}

export type MapEventHandler = (event: any) => void;

export interface MapCallbacks {
  onMarkerClick?: (marker: MarkerData) => void;
  onMarkerHover?: (marker: MarkerData | null) => void;
  onMapClick?: (position: MapPosition) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  onZoomChange?: (zoom: number) => void;
}
```

### Base Map Component

```typescript
// packages/ui-framework/src/map/BaseMap.tsx

import React, { useRef, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import type { MapConfig, MapCallbacks, MapPosition } from './types';

export interface BaseMapProps {
  config?: MapConfig;
  callbacks?: MapCallbacks;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Base map component using Leaflet and OpenStreetMap
 * 
 * @example
 * ```tsx
 * <BaseMap
 *   config={{
 *     center: { latitude: 37.62, longitude: -122.38, zoom: 10 },
 *     scrollWheelZoom: true
 *   }}
 *   callbacks={{
 *     onMarkerClick: (marker) => console.log(marker),
 *     onBoundsChange: (bounds) => console.log(bounds)
 *   }}
 * >
 *   <Marker position={{ latitude: 37.62, longitude: -122.38 }} title="KSFO" />
 * </BaseMap>
 * ```
 */
export function BaseMap({
  config = {},
  callbacks = {},
  children,
  className = '',
  style = {}
}: BaseMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);

  const {
    center = { latitude: 39.8283, longitude: -98.5795, zoom: 4 }, // Center of USA
    zoom = center.zoom || 4,
    minZoom = 2,
    maxZoom = 18,
    scrollWheelZoom = true,
    dragging = true,
    touchZoom = true,
    doubleClickZoom = true,
    zoomControl = true,
    attributionControl = true
  } = config;

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Set up event listeners
    if (callbacks.onBoundsChange) {
      map.on('moveend', () => {
        const bounds = map.getBounds();
        callbacks.onBoundsChange?.({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        });
      });
    }

    if (callbacks.onZoomChange) {
      map.on('zoomend', () => {
        callbacks.onZoomChange?.(map.getZoom());
      });
    }

    if (callbacks.onMapClick) {
      map.on('click', (e) => {
        callbacks.onMapClick?.({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        });
      });
    }

    return () => {
      map.off('moveend');
      map.off('zoomend');
      map.off('click');
    };
  }, [callbacks]);

  const defaultStyle: React.CSSProperties = {
    width: '100%',
    height: '500px',
    ...style
  };

  return (
    <MapContainer
      ref={mapRef}
      center={[center.latitude, center.longitude]}
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      scrollWheelZoom={scrollWheelZoom}
      dragging={dragging}
      touchZoom={touchZoom}
      doubleClickZoom={doubleClickZoom}
      zoomControl={zoomControl}
      attributionControl={attributionControl}
      className={className}
      style={defaultStyle}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      {children}
    </MapContainer>
  );
}
```

### Marker Component

```typescript
// packages/ui-framework/src/map/Marker.tsx

import React from 'react';
import { Marker as LeafletMarker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { MarkerData } from './types';

export interface MarkerProps extends MarkerData {
  onClick?: (marker: MarkerData) => void;
  onHover?: (marker: MarkerData | null) => void;
  showPopup?: boolean;
  showTooltip?: boolean;
}

/**
 * Map marker component with popup and tooltip support
 * 
 * @example
 * ```tsx
 * <Marker
 *   id="ksfo"
 *   position={{ latitude: 37.62, longitude: -122.38 }}
 *   title="KSFO"
 *   subtitle="San Francisco International"
 *   color="#3b82f6"
 *   onClick={(marker) => console.log('Clicked:', marker)}
 *   showTooltip
 * />
 * ```
 */
export function Marker({
  id,
  position,
  title,
  subtitle,
  icon = { type: 'default' },
  color = '#3b82f6',
  metadata,
  onClick,
  onHover,
  showPopup = false,
  showTooltip = true
}: MarkerProps) {
  const leafletIcon = createLeafletIcon(icon, color);

  const markerData: MarkerData = {
    id,
    position,
    title,
    subtitle,
    icon,
    color,
    metadata
  };

  const handleClick = () => {
    onClick?.(markerData);
  };

  const handleMouseOver = () => {
    onHover?.(markerData);
  };

  const handleMouseOut = () => {
    onHover?.(null);
  };

  return (
    <LeafletMarker
      position={[position.latitude, position.longitude]}
      icon={leafletIcon}
      eventHandlers={{
        click: handleClick,
        mouseover: handleMouseOver,
        mouseout: handleMouseOut
      }}
    >
      {showTooltip && title && (
        <Tooltip direction="top" offset={[0, -20]}>
          <div>
            <strong>{title}</strong>
            {subtitle && <div style={{ fontSize: '0.85em' }}>{subtitle}</div>}
          </div>
        </Tooltip>
      )}

      {showPopup && (title || subtitle) && (
        <Popup>
          <div>
            {title && <h3 style={{ margin: '0 0 0.5em 0' }}>{title}</h3>}
            {subtitle && <p style={{ margin: 0 }}>{subtitle}</p>}
            {metadata && (
              <div style={{ marginTop: '0.5em', fontSize: '0.85em' }}>
                {Object.entries(metadata).map(([key, value]) => (
                  <div key={key}>
                    <strong>{key}:</strong> {String(value)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Popup>
      )}
    </LeafletMarker>
  );
}

function createLeafletIcon(icon: MarkerIcon, color: string): L.Icon {
  if (icon.type === 'custom' && icon.url) {
    return L.icon({
      iconUrl: icon.url,
      iconSize: icon.size || [25, 41],
      iconAnchor: icon.anchor || [12, 41],
      popupAnchor: [1, -34]
    });
  }

  // Default marker with custom color
  const svgIcon = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" 
            fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="12.5" cy="12.5" r="6" fill="#fff"/>
    </svg>
  `;

  const iconUrl = `data:image/svg+xml;base64,${btoa(svgIcon)}`;

  return L.icon({
    iconUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  });
}
```

### Marker Clustering

```typescript
// packages/ui-framework/src/map/MarkerCluster.tsx

import React from 'react';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Marker } from './Marker';
import type { MarkerData, ClusterConfig } from './types';

export interface MarkerClusterProps {
  markers: MarkerData[];
  config?: ClusterConfig;
  onMarkerClick?: (marker: MarkerData) => void;
  onMarkerHover?: (marker: MarkerData | null) => void;
  showTooltips?: boolean;
}

/**
 * Clustered markers component for efficient rendering of many markers
 * 
 * @example
 * ```tsx
 * <MarkerCluster
 *   markers={accidents.map(a => ({
 *     id: a.id,
 *     position: { latitude: a.lat, longitude: a.lon },
 *     title: a.aircraft_type,
 *     subtitle: a.date,
 *     color: a.category === 'Commercial' ? '#ef4444' : '#3b82f6'
 *   }))}
 *   config={{
 *     enabled: true,
 *     maxClusterRadius: 80,
 *     disableClusteringAtZoom: 15
 *   }}
 *   onMarkerClick={(marker) => console.log(marker)}
 * />
 * ```
 */
export function MarkerCluster({
  markers,
  config = { enabled: true },
  onMarkerClick,
  onMarkerHover,
  showTooltips = true
}: MarkerClusterProps) {
  const {
    enabled = true,
    maxClusterRadius = 80,
    disableClusteringAtZoom = 15,
    spiderfyOnMaxZoom = true,
    showCoverageOnHover = false
  } = config;

  if (!enabled) {
    return (
      <>
        {markers.map(marker => (
          <Marker
            key={marker.id}
            {...marker}
            onClick={onMarkerClick}
            onHover={onMarkerHover}
            showTooltip={showTooltips}
          />
        ))}
      </>
    );
  }

  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={maxClusterRadius}
      disableClusteringAtZoom={disableClusteringAtZoom}
      spiderfyOnMaxZoom={spiderfyOnMaxZoom}
      showCoverageOnHover={showCoverageOnHover}
    >
      {markers.map(marker => (
        <Marker
          key={marker.id}
          {...marker}
          onClick={onMarkerClick}
          onHover={onMarkerHover}
          showTooltip={showTooltips}
        />
      ))}
    </MarkerClusterGroup>
  );
}
```

### Polyline Component

```typescript
// packages/ui-framework/src/map/Polyline.tsx

import React from 'react';
import { Polyline as LeafletPolyline, Popup } from 'react-leaflet';
import type { PolylineData } from './types';

export interface PolylineProps extends PolylineData {
  onClick?: (polyline: PolylineData) => void;
  showPopup?: boolean;
  popupContent?: React.ReactNode;
}

/**
 * Polyline component for drawing routes and paths
 * 
 * @example
 * ```tsx
 * <Polyline
 *   id="route1"
 *   coordinates={[
 *     { latitude: 37.62, longitude: -122.38 },
 *     { latitude: 40.64, longitude: -73.78 }
 *   ]}
 *   color="#3b82f6"
 *   weight={4}
 *   opacity={0.7}
 *   onClick={(polyline) => console.log('Route clicked:', polyline)}
 * />
 * ```
 */
export function Polyline({
  id,
  coordinates,
  color = '#3b82f6',
  weight = 3,
  opacity = 0.7,
  dashed = false,
  onClick,
  showPopup = false,
  popupContent
}: PolylineProps) {
  const positions = coordinates.map(coord => [
    coord.latitude,
    coord.longitude
  ]) as [number, number][];

  const polylineData: PolylineData = {
    id,
    coordinates,
    color,
    weight,
    opacity,
    dashed
  };

  const handleClick = () => {
    onClick?.(polylineData);
  };

  return (
    <LeafletPolyline
      positions={positions}
      pathOptions={{
        color,
        weight,
        opacity,
        dashArray: dashed ? '10, 10' : undefined
      }}
      eventHandlers={{
        click: handleClick
      }}
    >
      {showPopup && popupContent && (
        <Popup>{popupContent}</Popup>
      )}
    </LeafletPolyline>
  );
}
```

### Map State Hook

```typescript
// packages/ui-framework/src/map/useMapState.ts

import { useState, useCallback } from 'react';
import type { MapPosition, MapBounds, MarkerData } from './types';

export interface MapState {
  center: MapPosition;
  zoom: number;
  bounds: MapBounds | null;
  selectedMarker: MarkerData | null;
  hoveredMarker: MarkerData | null;
}

export interface MapStateActions {
  setCenter: (center: MapPosition) => void;
  setZoom: (zoom: number) => void;
  setBounds: (bounds: MapBounds) => void;
  selectMarker: (marker: MarkerData | null) => void;
  hoverMarker: (marker: MarkerData | null) => void;
  reset: () => void;
}

const initialState: MapState = {
  center: { latitude: 39.8283, longitude: -98.5795, zoom: 4 },
  zoom: 4,
  bounds: null,
  selectedMarker: null,
  hoveredMarker: null
};

/**
 * Hook for managing map state
 * 
 * @example
 * ```tsx
 * function MyMap() {
 *   const [state, actions] = useMapState();
 *   
 *   return (
 *     <BaseMap
 *       config={{ center: state.center, zoom: state.zoom }}
 *       callbacks={{
 *         onMarkerClick: actions.selectMarker,
 *         onBoundsChange: actions.setBounds
 *       }}
 *     >
 *       {state.selectedMarker && (
 *         <div>Selected: {state.selectedMarker.title}</div>
 *       )}
 *     </BaseMap>
 *   );
 * }
 * ```
 */
export function useMapState(
  initial: Partial<MapState> = {}
): [MapState, MapStateActions] {
  const [state, setState] = useState<MapState>({
    ...initialState,
    ...initial
  });

  const setCenter = useCallback((center: MapPosition) => {
    setState(prev => ({ ...prev, center }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState(prev => ({ ...prev, zoom }));
  }, []);

  const setBounds = useCallback((bounds: MapBounds) => {
    setState(prev => ({ ...prev, bounds }));
  }, []);

  const selectMarker = useCallback((marker: MarkerData | null) => {
    setState(prev => ({ ...prev, selectedMarker: marker }));
  }, []);

  const hoverMarker = useCallback((marker: MarkerData | null) => {
    setState(prev => ({ ...prev, hoveredMarker: marker }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...initialState, ...initial });
  }, [initial]);

  const actions: MapStateActions = {
    setCenter,
    setZoom,
    setBounds,
    selectMarker,
    hoverMarker,
    reset
  };

  return [state, actions];
}
```

---

## Testing Requirements

### Component Tests

```typescript
// packages/ui-framework/src/map/BaseMap.test.tsx

import { render, screen } from '@testing-library/react';
import { BaseMap } from './BaseMap';

describe('BaseMap', () => {
  test('renders with default config', () => {
    render(<BaseMap />);
    const map = screen.getByRole('region');
    expect(map).toBeInTheDocument();
  });

  test('respects center prop', () => {
    const { container } = render(
      <BaseMap
        config={{
          center: { latitude: 37.62, longitude: -122.38, zoom: 10 }
        }}
      />
    );
    
    // Check map center (implementation specific)
    expect(container.querySelector('.leaflet-container')).toBeInTheDocument();
  });

  test('renders children', () => {
    render(
      <BaseMap>
        <div data-testid="child">Child content</div>
      </BaseMap>
    );
    
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

describe('Marker', () => {
  test('renders at correct position', () => {
    render(
      <BaseMap>
        <Marker
          id="test"
          position={{ latitude: 37.62, longitude: -122.38 }}
          title="Test Marker"
        />
      </BaseMap>
    );
    
    // Check marker exists (implementation specific)
  });

  test('calls onClick when clicked', async () => {
    const handleClick = jest.fn();
    
    render(
      <BaseMap>
        <Marker
          id="test"
          position={{ latitude: 37.62, longitude: -122.38 }}
          onClick={handleClick}
        />
      </BaseMap>
    );
    
    // Simulate click and verify
  });
});

describe('MarkerCluster', () => {
  const markers = [
    { id: 1, position: { latitude: 37.62, longitude: -122.38 }, title: 'M1' },
    { id: 2, position: { latitude: 37.63, longitude: -122.39 }, title: 'M2' },
    { id: 3, position: { latitude: 37.64, longitude: -122.40 }, title: 'M3' }
  ];

  test('renders all markers', () => {
    render(
      <BaseMap>
        <MarkerCluster markers={markers} />
      </BaseMap>
    );
    
    // Check markers exist
  });

  test('disables clustering when config.enabled = false', () => {
    render(
      <BaseMap>
        <MarkerCluster
          markers={markers}
          config={{ enabled: false }}
        />
      </BaseMap>
    );
    
    // Verify no clustering
  });
});
```

### Test Coverage Target

- **Overall:** >70% (UI components harder to test)
- **Core logic:** 90%+
- **Utilities:** 100%

---

## Migration Path

1. Create ui-framework package structure
2. Implement TypeScript React components
3. Extract Leaflet patterns from flight-planner
4. Add marker clustering
5. Write component tests
6. Documentation with Storybook (optional)
7. Integrate into accident-tracker
8. Update flight-planner later

---

## Dependencies

### NPM Packages

```json
{
  "dependencies": {
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "react-leaflet-cluster": "^2.1.0"
  },
  "peerDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

---

## Acceptance Criteria

- [ ] BaseMap component complete and tested
- [ ] Marker component with popup/tooltip
- [ ] Marker clustering functional
- [ ] Polyline component for routes
- [ ] Map controls (zoom, layers)
- [ ] useMapState hook working
- [ ] Responsive on mobile
- [ ] Accessibility (keyboard navigation)
- [ ] Performance optimized (60fps)
- [ ] Tests passing (>70% coverage)
- [ ] Documentation complete
- [ ] Ready for accident-tracker integration

---

## Timeline

**Day 1:** BaseMap + Marker components
**Day 2:** Marker clustering + Polyline
**Day 3:** Controls + hooks + tests
**Day 4:** Polish, docs, accessibility

---

**Status:** Ready for implementation
**Dependencies:** None (independent component library)
**Target Completion:** 3-4 days
