# `aviation.avionics` interface

## Protocol records

- `TelemetrySnapshot` carries position, attitude, air-data, GPS, ADF, DME,
  autopilot, audio-panel, transponder, velocity, target, timestamp, and optional
  metadata fields with units encoded in field names.
- `TelemetryUpdate` is a recursively partial update of the snapshot domains.
- `CommandPayload` is the closed union of reset, target, ADF, DME, autopilot,
  audio-panel, and transponder commands.
- `FlightPlan` contains typed segments, ordered legs, and unit-explicit waypoints.

## Protocol operations

- `isTelemetrySnapshot(value) -> boolean`
- `isTelemetryUpdate(value) -> boolean`
- `isCommandPayload(value) -> boolean`
- `isFlightPlan(value) -> boolean`
- `importFlightPlan(format, payload) -> FlightPlan`
- `exportFlightPlan(format, plan) -> exchange payload`
- `computeRouteDistanceNm(plan) -> number`
- `computeRouteBearingDeg(from, to) -> number | undefined`

## Rendering records and operations

- `Viewport(x, y, width, height)` defines a canvas-relative rectangle.
- `PfdTelemetry`, `MfdTelemetry`, themes, layers, scene graphs, and pipeline records
  are portable display inputs and composition contracts.
- `computePfdLayout(viewport, config?) -> PfdLayoutMetrics`
- `computeMfdEngineLayout(viewport, config?) -> MfdEngineLayoutMetrics`
- `createPfdPipeline(options) -> PfdPipeline`
- `createMfdPipeline(options) -> MfdPipeline`
- `drawAttitudeSphere`, `drawCompassRose`, `drawArcIndicator`, `drawMarker`,
  `drawTape`, and `drawText` render through a supplied canvas context.

## Compatibility boundary

Applications MAY retain transport hooks, reconnection policy, stores, simulator
orchestration, page selection, alerts, and display composition. Placeholder device
models that return fixed zero values are not part of this interface and cannot become
authority without their own physical contracts and acceptance vectors.
