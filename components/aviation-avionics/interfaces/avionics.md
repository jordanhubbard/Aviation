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

## Device-model records and operations

- `AhrsSolution` carries normalized pitch, roll, yaw, true and magnetic heading,
  magnetic variation, and slip/skid, with angular units encoded in field names.
- `AdcSolution` carries IAS, CAS, TAS, pressure and density altitude, vertical speed,
  and outside-air temperature with explicit units.
- `GpsSolution` carries the deterministic position fix, ground track/speed,
  WAAS/RAIM state, fix validity, and horizontal/vertical accuracy.
- `computeAhrs(input) -> AhrsSolution`
- `computeAdc(input) -> AdcSolution`
- `computeGps(input) -> GpsSolution`
- `AdfStation` and `DmeStation` carry explicit station identity, frequency, position,
  service volume, and DME elevation inputs.
- `AdfSolution` carries tuned frequency, resolved station identity, true and relative
  bearing, great-circle distance, signal strength, and receiver availability.
- `DmeSolution` carries tuned frequency, resolved station identity, slant range,
  station-relative ground speed, signal strength, and receiver availability.
- `computeAdf(input) -> AdfSolution`
- `computeDme(input) -> DmeSolution`

## Compatibility boundary

Applications MAY retain transport hooks, reconnection policy, stores, simulator
orchestration, page selection, alerts, display composition, and physical radio/device
I/O. They SHALL supply navigation-station data explicitly rather than embedding a
provider or operational database in the receiver model.
