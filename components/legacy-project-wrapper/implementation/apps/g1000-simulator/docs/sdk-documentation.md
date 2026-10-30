# G1000 Simulator — SDK Documentation

This document covers the five SDK packages that power the G1000 Simulator. Each package is independently versioned and can be used outside of the simulator context.

| Package | Location | Language | Purpose |
|---------|----------|----------|---------|
| `g1000-avionics-sdk` | `packages/g1000-avionics-sdk/` | TypeScript + Python | Qualified AHRS, ADC, and GPS sensor models |
| `g1000-rendering` | `packages/g1000-rendering/` | TypeScript | Canvas rendering pipeline for PFD and MFD |
| `flight-dynamics` | `packages/flight-dynamics/` | Python | Aircraft physics, autopilot controllers, performance |
| `shared-sdk` | `packages/shared-sdk/` | TypeScript + Python | Common airports, navigation-data records, catalogs, queries, validation, and procedures |
| `nav-data` | `packages/nav-data/` | TypeScript | OurAirports, openAIP, and FAA CIFP provider adapters |
| `g1000-protocols` | `packages/g1000-protocols/` | TypeScript | WebSocket and REST message types, flight plan formats |

---

## avionics-sdk (`packages/g1000-avionics-sdk/`)

The avionics SDK provides deterministic AHRS, ADC, and GPS functions in TypeScript
and Python. Both implementations consume the same `aviation.avionics` acceptance
vectors and reject invalid numeric or coordinate inputs.

```python
from aviation_avionics import compute_adc, compute_ahrs, compute_gps
```

```typescript
import { computeAdc, computeAhrs, computeGps } from '@aviation/g1000-avionics-sdk'
```

The models return unit-explicit immutable solution records. G1000 and Flight Planner
retain only compatibility exports; simulator stepping and transport remain application
responsibilities. Radio models are not yet qualified and are intentionally absent from
the package.

---

## g1000-rendering (`packages/g1000-rendering/`)

A TypeScript canvas rendering library for the G1000 PFD and MFD. The library uses a layered scene graph model where each display element is a layer with a `render` function.

### PFD Rendering Pipeline

**File:** `src/pfd/pipeline.ts`

The PFD pipeline drives the rendering loop for the Primary Flight Display.

```typescript
import { createPfdPipeline } from '@aviation/g1000-rendering';

const pipeline = createPfdPipeline({
  ctx: canvas.getContext('2d'),
  viewport: { x: 0, y: 0, width: 1024, height: 768 },
  telemetry: initialTelemetry,
  loop: { targetHz: 20 },
  theme: 'day',
});

pipeline.start();

// Update telemetry from WebSocket
pipeline.setTelemetry(newTelemetry);

// Stop when unmounting
pipeline.stop();
```

#### `createPfdPipeline(options: PfdPipelineOptions): PfdPipeline`

Creates a PFD rendering pipeline instance. Options:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `ctx` | `CanvasRenderingContext2D` | yes | Canvas 2D context to render into |
| `viewport` | `Viewport` | yes | Rendering region `{ x, y, width, height }` |
| `telemetry` | `PfdTelemetry` | yes | Initial telemetry data |
| `sceneGraph` | `PfdSceneGraph` | no | Custom scene graph (defaults to standard PFD layers) |
| `loop` | `Partial<PfdRenderLoopConfig>` | no | Loop configuration |
| `theme` | `G1000ThemeSource` | no | `'day'`, `'night'`, or `'highcontrast'` |
| `themeManager` | `G1000ThemeManager` | no | Shared theme manager for synchronized display themes |
| `performance` | `PfdPerformanceHooks` | no | Performance monitoring callbacks |
| `onFrameRendered` | `(frame: PfdFrame) => void` | no | Callback invoked after each frame |

#### `PfdPipeline` methods

| Method | Description |
|--------|-------------|
| `start()` | Begin the render loop |
| `stop()` | Stop the render loop |
| `renderOnce(nowMs?)` | Render a single frame (useful for testing) |
| `setTelemetry(telemetry)` | Update the telemetry data driving the display |
| `setViewport(viewport)` | Update the rendering viewport (for resize events) |
| `setSceneGraph(sceneGraph)` | Replace the entire scene graph |
| `getSceneGraph()` | Returns the current scene graph |
| `setTheme(theme)` | Change the display theme |
| `getTheme()` | Returns the current resolved theme |
| `getPerformanceStats()` | Returns frame timing statistics |
| `resetPerformanceStats()` | Resets accumulated performance counters |

#### PFD Telemetry Schema (`PfdTelemetry`)

```typescript
type PfdTelemetry = {
  attitude: {
    heading_deg: number;
    pitch_deg: number;
    roll_deg: number;
    slip_skid_deg?: number;
  };
  adc: {
    ias_kt: number;
    tas_kt: number;
    pressure_altitude_ft: number;
    vertical_speed_fpm: number;
  };
  gps: {
    ground_speed_kt: number;
    track_deg: number;
  };
  targets?: {
    heading_deg?: number;
    airspeed_kt?: number;
    altitude_ft?: number;
  };
  autopilot?: {
    master_on: boolean;
    lateral_mode: string;
    vertical_mode: string;
  };
  nav?: {
    source?: string;
    course_deg?: number;
    deviation_dots?: number;
    to_from?: 'to' | 'from';
  };
  timestamp?: number;
};
```

#### PFD Layer IDs

The default scene graph renders layers in this order:

| Layer ID | Renders |
|----------|---------|
| `background` | Black background fill |
| `attitude` | Attitude sphere (blue sky / brown earth, pitch ladder, roll scale) |
| `tapes` | Airspeed tape, altimeter tape, and VSI |
| `hsi` | Horizontal situation indicator, compass rose, CDI |
| `nav` | Navigation data fields |
| `autopilot` | Autopilot mode annunciation strip |
| `overlays` | Selected altitude and heading bugs |
| `alerts` | Master warning / caution lights, alert text |
| `text` | Static labels and readouts |

To replace a layer with a custom renderer:

```typescript
const sceneGraph = pipeline.getSceneGraph();
const attitudeLayer = sceneGraph.layers.find(l => l.id === 'attitude');
if (attitudeLayer) {
  attitudeLayer.render = (ctx, frame) => {
    // Custom attitude rendering
  };
}
pipeline.setSceneGraph(sceneGraph);
```

---

### MFD Rendering Pipeline

**File:** `src/mfd/pipeline.ts`

The MFD pipeline is page-based: each page (`map`, `terrain`, `weather`, `traffic`, `engine`, `utilities`) has its own scene graph.

```typescript
import { createMfdPipeline } from '@aviation/g1000-rendering';

const pipeline = createMfdPipeline({
  ctx: canvas.getContext('2d'),
  viewport: { x: 0, y: 0, width: 1024, height: 768 },
  telemetry: initialMfdTelemetry,
  initialPage: 'map',
  theme: 'day',
});

pipeline.start();
pipeline.setActivePage('engine');
```

#### `createMfdPipeline(options: MfdPipelineOptions): MfdPipeline`

Creates an MFD rendering pipeline. Key options beyond those shared with `createPfdPipeline`:

| Option | Type | Description |
|--------|------|-------------|
| `initialPage` | `MfdPageId` | Starting page (`'map'` by default) |
| `pages` | `Partial<MfdPageRegistry>` | Custom page scene graphs |
| `onPageChanged` | `(next, previous) => void` | Callback when the active page changes |

#### `MfdPipeline` methods

All `PfdPipeline` methods are available, plus:

| Method | Description |
|--------|-------------|
| `setActivePage(page)` | Switch the visible MFD page |
| `getActivePage()` | Returns the current page ID |
| `setPageSceneGraph(page, sceneGraph)` | Replace the scene graph for a specific page |
| `getPageSceneGraph(page)` | Returns the scene graph for a page |
| `getPages()` | Returns the complete page registry |

#### MFD Pages

| Page ID | Description |
|---------|-------------|
| `map` | Moving map with terrain, weather, and traffic overlays |
| `terrain` | Full-screen terrain elevation display |
| `weather` | NEXRAD and weather overlay |
| `traffic` | Traffic display with altitude tags |
| `engine` | Engine monitoring gauges |
| `utilities` | Trip planning and calculators |

---

### Rendering Primitives

**File:** `src/primitives/index.ts`

Low-level drawing functions used by PFD and MFD layers.

#### `drawAttitudeSphere(ctx, viewport, options)`

Draws the attitude indicator background (blue sky / brown earth) with pitch ladder and roll scale.

```typescript
drawAttitudeSphere(ctx, { x: 100, y: 50, width: 300, height: 300 }, {
  pitchDeg: 5.0,
  rollDeg: -15.0,
});
```

#### `drawCompassRose(ctx, viewport, options)`

Draws a rotating compass rose with degree markings.

```typescript
drawCompassRose(ctx, viewport, {
  headingDeg: 310.0,
  radiusPx: 120,
  color: '#e2e8f0',
});
```

#### `drawTape(ctx, viewport, options)`

Draws a vertical scrolling tape instrument (airspeed or altitude).

```typescript
drawTape(ctx, { x: 0, y: 0, width: 80, height: 600 }, {
  value: 112,
  min: 0,
  max: 200,
  majorTick: 20,
  minorTick: 10,
  labelStep: 20,
  units: 'KT',
  style: DEFAULT_TAPE_STYLE,
});
```

#### `drawArcIndicator(ctx, options)`

Draws a circular arc gauge (for engine parameters, VSI, etc.).

#### `drawText(ctx, x, y, text, options)`

Draws formatted text with alignment and font control.

```typescript
drawText(ctx, 512, 40, 'HDG 310°', {
  font: '14px monospace',
  color: '#00d4ff',
  align: 'center',
});
```

#### `normalizeDegrees(deg: number): number`

Normalizes any degree value to the range [0, 360).

#### `withRotation(ctx, centerX, centerY, rotationDeg, fn)`

Applies a rotation transformation centered at `(centerX, centerY)` for the duration of `fn`, then restores the context.

---

### Themes

**File:** `src/themes/index.ts`

Three built-in themes are available. Pass the theme name as a string or use the `G1000ThemeManager` for runtime switching.

| Theme | Description |
|-------|-------------|
| `'day'` | Standard daytime colors (bright backgrounds, high contrast) |
| `'night'` | Dark backgrounds with dimmed colors to preserve night vision |
| `'highcontrast'` | Maximum contrast for high ambient light conditions |

```typescript
import { resolveG1000Theme, createG1000ThemeManager } from '@aviation/g1000-rendering';

// Single theme
const theme = resolveG1000Theme('night');

// Synchronized theme manager (shared between PFD and MFD)
const themeManager = createG1000ThemeManager('day');
themeManager.setTheme('night'); // Both pipelines update if using the same manager
```

---

## flight-dynamics (`packages/flight-dynamics/`)

A physics-based flight dynamics library written in Python. It provides six-degree-of-freedom (6-DOF) equations of motion, aircraft configuration models, ISA atmosphere, and autopilot controllers.

### Aircraft Models

**Directory:** `aviation_flight_dynamics/aircraft/models/`

Three aircraft configurations are available:

| Module | Function | Aircraft |
|--------|----------|---------|
| `cessna_172` | `load_c172_config()` | Cessna 172S Skyhawk |
| `cessna_182` | `load_c182_config()` | Cessna 182T Skylane |
| `cirrus_sr22` | `load_sr22_config()` | Cirrus SR22 |

```python
from aviation_flight_dynamics.aircraft.models.cessna_172 import load_c172_config

config = load_c172_config()
print(config.name)              # "Cessna 172S Skyhawk"
print(config.engine.rated_hp)  # 180
```

Each `AircraftConfig` contains:

| Attribute | Type | Description |
|-----------|------|-------------|
| `aircraft_id` | str | Short identifier (`c172`, `c182`, `sr22`) |
| `name` | str | Full aircraft name |
| `manufacturer` | str | Manufacturer name |
| `mass_properties` | `MassProperties` | Empty weight, MTOW, CG limits, inertia tensor |
| `aerodynamics` | `AerodynamicModel` | Wing geometry, lift/drag coefficients, control surfaces |
| `engine` | `EngineConfig` | Engine type, rated HP, fuel type, prop parameters |
| `fuel` | `FuelSystemConfig` | Tank capacities, fuel density, unusable fuel |
| `limits` | `AircraftLimits` | Vne, Vno, Va, Vs, Vfe, Vx, Vy, Vglide |
| `performance` | `PerformanceConfig` | Climb rate, service ceiling, cruise speed, range |
| `variants` | dict | Optional airframe variants (e.g., G1000-equipped vs. steam gauge) |

### Physics Simulation

**File:** `aviation_flight_dynamics/physics/`

The physics package implements the standard 6-DOF rigid body equations of motion using Newton-Euler formalism.

Key classes:

| Class | File | Description |
|-------|------|-------------|
| `ForceModel` | `force_model.py` | Computes aerodynamic forces (lift, drag, side force) and moments |
| `Environment` | `environment.py` | Wind vector, density altitude, temperature |
| `Atmosphere` | `atmosphere.py` | ISA standard atmosphere with optional temperature offset |
| `WindModel` | `wind.py` | Steady wind and turbulence (Dryden model) |
| `PhysicsIntegrator` | `integrator.py` | Runge-Kutta 4 integration of equations of motion |

```python
from aviation_flight_dynamics.physics.atmosphere import Atmosphere
from aviation_flight_dynamics.physics.environment import Environment

atm = Atmosphere()
pressure, temp, density = atm.conditions_at_altitude(altitude_ft=5000)

env = Environment(wind_knots=15.0, wind_direction_deg=270.0)
wind_vector = env.wind_at_altitude(altitude_ft=5000)
```

### Autopilot Controllers

**Directory:** `aviation_flight_dynamics/autopilot/`

The autopilot package provides PID controllers, mode state management, envelope protection, and autotrim.

#### Mode Enumerations

**File:** `autopilot/modes.py`

```python
from aviation_flight_dynamics.autopilot.modes import (
    AutopilotModeController,
    LateralMode,
    VerticalMode,
)

controller = AutopilotModeController()

# Engage master
controller.engage()

# Set modes
controller.set_lateral_mode(LateralMode.HDG)   # Returns True (accepted)
controller.set_vertical_mode(VerticalMode.ALT)  # Returns True

# Arm approach (required before GS/GP)
controller.arm_approach()
controller.set_vertical_mode(VerticalMode.GS)  # Returns True

# Disengage (resets all modes to ROL / PIT)
controller.disengage()
```

**Lateral modes:**

| `LateralMode` | Value | Description |
|---------------|-------|-------------|
| `ROL` | `"ROL"` | Wings-level roll hold |
| `HDG` | `"HDG"` | Heading select |
| `NAV` | `"NAV"` | VOR/GPS track |
| `APR` | `"APR"` | Localizer approach |
| `BC` | `"BC"` | Back-course localizer |

**Vertical modes:**

| `VerticalMode` | Value | Description |
|----------------|-------|-------------|
| `PIT` | `"PIT"` | Pitch hold |
| `VS` | `"VS"` | Vertical speed hold |
| `ALT` | `"ALT"` | Altitude hold |
| `ALTS` | `"ALTS"` | Altitude select (capture) |
| `GS` | `"GS"` | ILS glideslope |
| `GP` | `"GP"` | GPS glidepath (LPV/LNAV/VNAV) |

**Mode transition rules:**
- All mode changes require `master_on = True`.
- `APR` and `BC` lateral modes automatically set `approach_armed = True`.
- `GS` and `GP` vertical modes require `approach_armed = True`.
- Calling `disengage()` resets all modes to `ROL` / `PIT` and clears `approach_armed`.

#### PID Controllers

**File:** `autopilot/pid.py`

Generic PID controller used by all autopilot modes.

```python
from aviation_flight_dynamics.autopilot.pid import PIDController

hdg_pid = PIDController(kp=1.5, ki=0.0, kd=0.3, output_min=-25.0, output_max=25.0)
bank_command = hdg_pid.update(error=heading_error_deg, dt=0.05)
```

| Constructor arg | Description |
|-----------------|-------------|
| `kp` | Proportional gain |
| `ki` | Integral gain |
| `kd` | Derivative gain |
| `output_min` | Lower clamp on output |
| `output_max` | Upper clamp on output |

#### Envelope Protection

**File:** `autopilot/envelope.py`

Implements pitch and bank angle limiting to prevent exceeding structural and aerodynamic limits.

- Bank limit: ±25° in normal operations (configurable)
- Pitch limit: −10° to +15° in normal operations
- Stall protection: autopilot pitches down when approaching critical AoA
- Overspeed protection: autopilot pitches up when approaching Vno

### Performance Calculations

**Directory:** `aviation_flight_dynamics/performance/`

| Module | Description |
|--------|-------------|
| `takeoff_climb.py` | Takeoff ground roll, liftoff speed, climb gradient |
| `cruise.py` | Cruise speed, fuel flow, range, endurance at selected power settings |
| `validation.py` | Validates computed performance values against published POH data |

```python
from aviation_flight_dynamics.performance.cruise import compute_cruise_performance
from aviation_flight_dynamics.aircraft.models.cessna_172 import load_c172_config

config = load_c172_config()
result = compute_cruise_performance(
    config=config,
    altitude_ft=8000,
    power_percent=65,
    temperature_offset_c=0,
)
print(result.true_airspeed_kt)   # ~122 kt
print(result.fuel_flow_gph)      # ~8.5 gal/hr
```

---

## nav-data (`packages/nav-data/`)

A TypeScript provider-ingestion package. It converts OurAirports CSV, openAIP
GeoJSON, and FAA CIFP records into the airport and navigation-data contracts owned by
`@aviation/shared-sdk`. It intentionally has no private database, cache, search,
distance, or procedure-selection API.

```typescript
import { NavDataCatalog } from '@aviation/shared-sdk/aviation/nav-data';
import { ingestNavData } from '@aviation/nav-data';

const result = ingestNavData({
  ourAirports: { airportsCsv, navaidsCsv },
  openAip: openAipGeoJson,
  faaCifp: cifpRecords,
});

const catalog = new NavDataCatalog(result.bundle);
const procedures = catalog.proceduresForAirport('KSJC');
```

Applications use the shared SDK directly for airport lookup, normalization, catalog
queries, proximity calculations, airspace validation, and procedure selection.

### Data Ingestion

**Directory:** `src/ingestion/`

Adapters for importing open-source datasets into common SDK contracts:

| Ingestion Module | Source |
|-----------------|--------|
| `ourairports.ts` | OurAirports CSV (airports and navaids) |
| `openaip.ts` | openAIP GeoJSON (airspaces) |
| `cifp.ts` | FAA CIFP procedure records |
| `csv.ts` | Generic CSV import |

The package test suite executes Component-owned synthetic provider vectors without
network access and verifies that all emitted records pass common SDK validation.

---

## g1000-protocols (`packages/g1000-protocols/`)

A TypeScript package providing shared type definitions, serialization, and validation for all G1000 communication protocols.

### WebSocket Protocol

**Directory:** `src/websocket/`

#### Core Types (`schema.ts`)

```typescript
// Envelope wrapping all messages
interface WebSocketEnvelope<TPayload = unknown> {
  version: string;        // Protocol version ("1.0.0")
  messageId: string;      // Unique message ID
  timestamp: string;      // ISO 8601
  type: WebSocketMessageType;
  topic?: WebSocketTopic;
  payload?: TPayload;
  status?: string;
  correlationId?: string;
  source?: string;
}

type WebSocketMessageType = 'telemetry' | 'command' | 'system' | 'ack' | 'error' | 'ping' | 'pong';
```

Topic constants are available through `WEBSOCKET_TOPICS`:

```typescript
import { WEBSOCKET_TOPICS } from '@aviation/g1000-protocols';

const topic = WEBSOCKET_TOPICS.telemetry.flightState;
// "telemetry.flight_state"
```

#### Telemetry Types (`telemetry.ts`)

The `TelemetrySnapshot` type represents a complete point-in-time flight state. Partial updates use `TelemetryUpdate` where every field is optional.

Key sub-types:

| Type | Fields |
|------|--------|
| `TelemetryPosition` | `latitude_deg`, `longitude_deg`, `altitude_ft` |
| `TelemetryAttitude` | `heading_deg`, `pitch_deg`, `roll_deg`, `slip_skid_deg`, `magnetic_variation_deg` |
| `TelemetryAdc` | `ias_kt`, `cas_kt`, `tas_kt`, `pressure_altitude_ft`, `density_altitude_ft`, `vertical_speed_fpm`, `oat_c` |
| `TelemetryGps` | `latitude_deg`, `longitude_deg`, `altitude_ft`, `ground_speed_kt`, `track_deg`, `waas_available`, `raim_ok`, `fix_valid`, `horizontal_accuracy_m`, `vertical_accuracy_m` |
| `TelemetryAutopilot` | `master_on`, `lateral_mode`, `vertical_mode`, `lateral_armed`, `vertical_armed`, `target_vertical_speed_fpm`, `bank_limit_active`, `pitch_limit_active` |
| `TelemetryTransponder` | `mode`, `squawk_code`, `ident_active`, `ident_remaining_sec` |
| `TelemetryAdf` | `tuned_frequency_khz`, `bearing_deg`, `relative_bearing_deg`, `distance_nm`, `receiving` |
| `TelemetryDme` | `tuned_frequency_mhz`, `slant_range_nm`, `ground_speed_kt`, `receiving` |
| `TelemetryAudioPanel` | COM/NAV enable flags, volume levels, marker beacon state |
| `TelemetryVelocity` | `airspeed_kt`, `vertical_speed_fpm`, `turn_rate_dps` |
| `TelemetryTargets` | `heading_deg`, `altitude_ft`, `airspeed_kt` |

Runtime validation guards are exported for all types:

```typescript
import { isTelemetrySnapshot, isTelemetryUpdate } from '@aviation/g1000-protocols';

const data = JSON.parse(rawMessage);
if (isTelemetrySnapshot(data)) {
  // data is TelemetrySnapshot
}
```

#### Command Types (`commands.ts`)

Commands are typed payloads sent from the frontend to the backend over WebSocket topic `command.*`.

| Command | Payload type | Key fields |
|---------|-------------|------------|
| `reset` | `ResetCommandPayload` | (none) |
| `set_targets` | `SetTargetsCommandPayload` | `targets.heading_deg`, `targets.altitude_ft`, `targets.airspeed_kt` |
| `set_autopilot` | `SetAutopilotCommandPayload` | `master_on`, `lateral_mode`, `vertical_mode`, `target_vertical_speed_fpm` |
| `set_adf` | `SetAdfCommandPayload` | `frequency_khz` |
| `set_dme` | `SetDmeCommandPayload` | `frequency_mhz` |
| `set_audio_panel` | `SetAudioPanelCommandPayload` | enable flags and volume levels |
| `set_transponder` | `SetTransponderCommandPayload` | `mode`, `squawk_code`, `ident` |

Validation:

```typescript
import { isCommandPayload } from '@aviation/g1000-protocols';

if (isCommandPayload(parsedPayload)) {
  // Safe to dispatch
}
```

#### WebSocket Client (`client.ts`)

A convenience class wrapping the browser `WebSocket` with automatic reconnection and message routing:

```typescript
import { G1000WebSocketClient } from '@aviation/g1000-protocols';

const client = new G1000WebSocketClient('ws://localhost:3000/ws');

client.on('telemetry.flight_state', (envelope) => {
  updateDisplays(envelope.payload);
});

client.on('system.alert', (envelope) => {
  handleAlert(envelope.payload);
});

client.connect();

// Send a command
client.send({
  type: 'command',
  topic: 'command.autopilot',
  payload: { command: 'set_autopilot', master_on: true, lateral_mode: 'HDG' },
});
```

---

### REST API Types

**Directory:** `src/api/`

TypeScript types for all REST request and response bodies, shared between frontend and backend.

Key types exported from `src/api/types.ts`:

| Type | Description |
|------|-------------|
| `ApiResponse<T>` | Standard response envelope with `success`, `data`, `error`, `metadata` |
| `ApiError` | Error object with `code`, `message`, `detail` |
| `FlightPlan` | Complete flight plan with segments and legs |
| `FlightPlanCreateRequest` | Payload for `POST /api/flight-plan` |
| `FlightPlanUpdateRequest` | Payload for `PUT /api/flight-plan/{id}` |
| `FlightPlanLoadRequest` | Payload for loading a plan via WebSocket |
| `AutopilotEngageRequest` | `{ master_on: boolean }` |
| `AutopilotModeRequest` | `{ lateral_mode?, vertical_mode?, target_vertical_speed_fpm? }` |
| `HeadingSetRequest` | `{ heading_deg: number }` |
| `AltitudeSetRequest` | `{ altitude_ft: number }` |
| `NavigationState` | Active flight plan state, active leg, CDI data |
| `SystemsState` | Autopilot, audio panel, transponder, targets |

---

### Flight Plan Formats

**Directory:** `src/formats/`

Converters for three flight plan interchange formats:

| Format | Version | `FlightPlanFormat` value |
|--------|---------|--------------------------|
| Garmin FPL (XML) | 1.0 | `"fpl"` |
| GPX | 1.1 | `"gpx"` |
| KML | 2.2 | `"kml"` |

```typescript
import { FLIGHT_PLAN_FORMATS, FLIGHT_PLAN_SPECS } from '@aviation/g1000-protocols';

console.log(FLIGHT_PLAN_FORMATS); // ["fpl", "gpx", "kml"]
console.log(FLIGHT_PLAN_SPECS.fpl.supportedFields);
// ["name", "origin", "destination", "waypoints.id", ...]
```

Format-specific types:

| Type | Format | Description |
|------|--------|-------------|
| `FplFlightPlan` | FPL | Garmin .fpl file structure |
| `FplWaypoint` | FPL | Single waypoint in .fpl format |
| `GpxRoute` | GPX | GPX route with `GpxRoutePoint` array |
| `KmlLineString` | KML | KML LineString with `KmlCoordinate` array |

Adapters for converting between the internal `FlightPlan` model and the format-specific types are in `src/formats/adapters.ts`.
