# @aviation/ui-framework

Shared UI components and patterns for aviation applications, including map components, multi-tab interfaces, and reusable UI utilities.

## Features

### 🗺️ Aviation Map Components

Comprehensive Leaflet-based map components optimized for aviation applications:

- **BaseMap** - Pre-configured map with aviation-optimized defaults
- **WindBarbMarker** - Meteorological wind barb markers with flight category color coding
- **WeatherOverlay** - OpenWeatherMap weather overlay layers
- **FitBounds** - Automatic map bounds fitting
- **Icons** - Wind barbs, airplane icons, and custom markers

### 🎨 Flight Category Color Coding

Standard aviation color schemes for VFR/MVFR/IFR/LIFR conditions:
- VFR (Visual Flight Rules): Green
- MVFR (Marginal VFR): Blue
- IFR (Instrument Flight Rules): Red
- LIFR (Low IFR): Purple

### 🧰 Utilities

- Unit conversions (nautical miles ↔ meters)
- Icon generation (wind barbs, circles, airplanes)
- Flight category validation

## Installation

```bash
npm install @aviation/ui-framework
```

### Peer Dependencies

```bash
npm install react react-dom leaflet react-leaflet
```

## Usage

### Basic Map

```tsx
import { BaseMap, FitBounds } from '@aviation/ui-framework';

function MyMap() {
  const airports = [
    [37.7749, -122.4194], // KSFO
    [40.7128, -74.0060],  // KJFK
  ];

  return (
    <BaseMap 
      center={[37.7749, -122.4194]} 
      zoom={4}
      style={{ height: '500px', width: '100%' }}
    >
      <FitBounds points={airports} padding={0.1} />
    </BaseMap>
  );
}
```

### Wind Barbs

```tsx
import { BaseMap, WindBarbMarker } from '@aviation/ui-framework';

function WeatherMap() {
  return (
    <BaseMap center={[37.7749, -122.4194]} zoom={9}>
      <WindBarbMarker
        position={[37.7749, -122.4194]}
        direction={270}
        speedKts={15}
        category="VFR"
        label="KSFO"
      />
    </BaseMap>
  );
}
```

### Weather Overlays

```tsx
import { BaseMap, WeatherOverlay } from '@aviation/ui-framework';

function WeatherMap() {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  return (
    <BaseMap center={[37.7749, -122.4194]} zoom={6}>
      <WeatherOverlay 
        type="clouds" 
        apiKey={apiKey} 
        opacity={0.5}
      />
      <WeatherOverlay 
        type="precipitation" 
        apiKey={apiKey} 
        opacity={0.6}
      />
    </BaseMap>
  );
}
```

### Flight Category Markers

```tsx
import { 
  BaseMap, 
  CircleMarker, 
  Popup,
  CATEGORY_COLORS,
  type FlightCategory 
} from '@aviation/ui-framework';

function AirportMap() {
  const category: FlightCategory = 'MVFR';
  const colors = CATEGORY_COLORS[category];

  return (
    <BaseMap center={[37.7749, -122.4194]} zoom={9}>
      <CircleMarker
        center={[37.7749, -122.4194]}
        radius={8}
        pathOptions={{
          fillColor: colors.fill,
          color: colors.stroke,
          weight: 2,
          fillOpacity: 0.9,
        }}
      >
        <Popup>
          KSFO - San Francisco International
          <br />
          Category: {category}
        </Popup>
      </CircleMarker>
    </BaseMap>
  );
}
```

### Custom Icons

```tsx
import { 
  BaseMap, 
  Marker, 
  createAirplaneIcon,
  createCircleIcon 
} from '@aviation/ui-framework';

function FlightMap() {
  const planeIcon = createAirplaneIcon('#1976d2', 32, 45); // 45° heading
  const circleIcon = createCircleIcon('#2e7d32', 16);

  return (
    <BaseMap center={[37.7749, -122.4194]} zoom={9}>
      <Marker position={[37.7749, -122.4194]} icon={planeIcon} />
      <Marker position={[37.6213, -122.3790]} icon={circleIcon} />
    </BaseMap>
  );
}
```

### Multiple Tile Layers

```tsx
import { BaseMap } from '@aviation/ui-framework';

function TopoMap() {
  return (
    <BaseMap 
      center={[37.7749, -122.4194]} 
      zoom={9}
      tileLayer="openTopoMap"  // or 'satellite'
    />
  );
}

function CustomMap() {
  return (
    <BaseMap 
      center={[37.7749, -122.4194]} 
      zoom={9}
      tileLayer="custom"
      customTileUrl="https://your-tile-server/{z}/{x}/{y}.png"
      customTileAttribution="© Your Attribution"
    />
  );
}
```

## API Reference

### Components

#### `<BaseMap>`

Base map component with aviation-optimized defaults.

**Props:**
- `center: LatLngExpression` - Center position [lat, lon]
- `zoom?: number` - Initial zoom level (default: 9)
- `scrollWheelZoom?: boolean` - Enable scroll zoom (default: true)
- `tileLayer?: 'openStreetMap' | 'openTopoMap' | 'satellite' | 'custom'` - Tile layer type
- `style?: React.CSSProperties` - Container style
- `children?: React.ReactNode` - Child components (markers, etc.)

#### `<WindBarbMarker>`

Wind barb marker following meteorological standards.

**Props:**
- `position: LatLngExpression` - Marker position
- `direction: number` - Wind direction (degrees, meteorological)
- `speedKts: number` - Wind speed in knots
- `category?: FlightCategory` - Flight category for color coding
- `size?: number` - Icon size (default: 40)
- `label?: string` - Popup label

#### `<WeatherOverlay>`

OpenWeatherMap weather overlay layer.

**Props:**
- `type: WeatherOverlayType` - 'clouds' | 'wind' | 'precipitation' | 'temperature'
- `apiKey: string` - OpenWeatherMap API key
- `opacity?: number` - Overlay opacity 0-1 (default: 0.6)
- `enabled?: boolean` - Enable/disable overlay (default: true)

#### `<FitBounds>`

Automatically fits map bounds to points.

**Props:**
- `points: LatLngExpression[]` - Array of coordinates
- `padding?: number` - Padding factor 0-1 (default: 0.25)
- `animate?: boolean` - Animate transition (default: true)
- `maxZoom?: number` - Maximum zoom level

### Hooks

#### `useFitBounds(points, options)`

Hook to fit map bounds programmatically.

```tsx
function MyComponent() {
  useFitBounds(
    [[37.7749, -122.4194], [40.7128, -74.0060]], 
    { padding: 0.1, animate: true }
  );
  return null;
}
```

### Utilities

#### `createWindBarbIcon(direction, speedKts, category?, size?)`

Creates a Leaflet DivIcon with a wind barb.

#### `createCircleIcon(color, size?, stroke?, strokeWidth?)`

Creates a simple circle icon.

#### `createAirplaneIcon(color?, size?, rotation?)`

Creates an airplane icon with optional rotation.

#### `toFlightCategory(value)`

Validates and normalizes flight category strings.

#### `nmToMeters(nm)` / `metersToNm(meters)`

Unit conversion utilities.

### Constants

#### `CATEGORY_COLORS`

Standard flight category color scheme:

```tsx
{
  VFR: { fill: '#2e7d32', stroke: '#ffffff' },
  MVFR: { fill: '#1976d2', stroke: '#ffffff' },
  IFR: { fill: '#d32f2f', stroke: '#ffffff' },
  LIFR: { fill: '#8e24aa', stroke: '#ffffff' },
  UNKNOWN: { fill: '#9e9e9e', stroke: '#ffffff' }
}
```

#### `DEFAULT_TILE_LAYERS`

Pre-configured tile layer URLs:
- `openStreetMap`
- `openTopoMap`
- `satellite`

#### `OPENWEATHER_LAYERS`

OpenWeatherMap layer types.

## TypeScript Support

Full TypeScript support with comprehensive type definitions.

```tsx
import type { 
  FlightCategory, 
  GeoPoint, 
  MapMarker,
  WindBarbConfig 
} from '@aviation/ui-framework';
```

## CSS

The package includes Leaflet CSS. Make sure it's imported:

```tsx
import 'leaflet/dist/leaflet.css'; // or import from @aviation/ui-framework
```

## Examples

See the [flightplanner app](../../apps/flightplanner) for real-world usage examples.

## License

MIT
