# `aviation.avionics` interface

## GDL90 input

`Gdl90Decoder.push(bytes)` incrementally validates framed/escaped datalink bytes
and returns `{messages, errors}`. `finish()` discards and reports an incomplete
pending frame. Python uses `Gdl90Decoder.push(bytes)` and `finish()` with the same
JSON-compatible result fields. No operation opens a socket or reads a clock.
Reject input chunks larger than 65,535 bytes, bound pending frame storage to 4,096
decoded bytes and emit at most 256 messages and 32 errors per call, with explicit
overflow indicators.
Recover at the next frame boundary after corrupt input; an invalid FCS never
produces a usable report. Retain complete standard message IDs and report an
unsupported ID explicitly rather than silently interpreting it as another type.

Reports preserve protocol identity, original data bytes and their declared units.
Heartbeat reports retain GPS/UTC validity and seconds since midnight. Ownship and
traffic retain participant address plus address type, coordinates, pressure
altitude in feet, speed in knots, vertical speed in feet per minute, angle reference,
NIC/NACp, alert status, airborne/extrapolated state, emitter category, callsign and
emergency code. Geometric altitude remains separate with its datum and vertical
quality/warning. Protocol invalid/unavailable sentinels become null with validity
metadata, never zero. Transport receipt time and per-receiver freshness are the
host bridge's responsibility.

Saturated speeds are bounds, not exact velocities. A horizontal saturation report
has null `horizontal_speed_kt` and `horizontal_speed_at_least_kt=4094`. Vertical
saturation has null `vertical_speed_fpm` and a signed `vertical_speed_bound_fpm`
of 32576 for a greater-than bound or -32576 for a less-than bound; the saturation
flags remain explicit. Reserved vertical encodings have no numeric velocity or
bound. Geometric altitude and its vertical quality must never relabel pressure
altitude or infer an MSL datum without the applicable extension declaration.

Python exposes framework-independent frozen `HeartbeatReport`, `TrafficReport`,
`GeometricAltitudeReport` and `UnsupportedReport` dataclasses as the `Gdl90Report`
union. Host HTTP schemas reuse these records rather than declaring another decoded
telemetry schema. Decoder results remain JSON-compatible dictionaries.

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

## Control-model records and operations

- `MarkerBeaconSite` is an explicit site, service-volume, and altitude-limit input.
- `computeMarkerBeacons(...) -> MarkerBeaconStatus` resolves mutually exclusive outer,
  middle, and inner indications.
- `AudioPanelState` carries source selection, output routing, and bounded source
  volumes; `computeAudioPanelStatus(...)` derives ADF and marker levels and lamps.
- `TransponderState` carries mode, four-digit octal squawk, and IDENT timing.
- `normalizeSquawk(value) -> four-digit code | unavailable`
- `transitionTransponder(current, transition) -> TransponderState`
- `RadioState` carries kind (`COM`/`NAV`), unit-explicit active and standby
  frequencies, volume, receive selection, and transmit state.
- `transitionRadio(current, transition) -> RadioState` tunes either frequency,
  swaps the pair, and applies volume/receive/PTT changes atomically. Tuning is
  validated before swapping; invalid current or proposed state is rejected.
  Python exposes `RadioState.transition(...)` returning a new immutable record.
- `AudioInputState` carries a boolean enable flag and volume in [0, 1].
- `transitionAudioInput(current, transition) -> AudioInputState` applies
  intercom/music/source changes atomically; Python exposes `transition(...)`.
- `resolveMarkerLights(outer, middle, inner) -> MarkerBeaconStatus` rejects
  non-boolean inputs and returns mutually exclusive lamps in inner-first order.

## Compatibility boundary

Applications MAY retain transport hooks, reconnection policy, stores, simulator
orchestration, page selection, alerts, display composition, and physical radio/device
I/O. They SHALL supply navigation-station data explicitly rather than embedding a
provider or operational database in the receiver model. Marker-site catalogs, audio
playback, COM transmission, simulator stepping, and physical transponder I/O likewise
remain application inputs or host responsibilities.
