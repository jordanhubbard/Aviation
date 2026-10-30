# Aviation avionics acceptance contract

An independent oracle loads `vectors.json` and evaluates protocol, rendering,
AHRS/ADC/GPS device cases, and ADF/DME receiver cases against the common packages.
Acceptance does not open a network connection, browser, simulator process, or physical
avionics device.

## Requirement: Telemetry and commands validate

### Scenario: Full, partial, and invalid payloads are classified

- **WHEN** the declared payloads are evaluated
- **THEN** valid snapshots and deltas pass while incomplete or ill-typed values fail

### Scenario: Commands are closed and typed

- **WHEN** declared valid and invalid command payloads are evaluated
- **THEN** only the supported commands with valid fields pass

## Requirement: Flight-plan exchange is deterministic

### Scenario: A GPX route is imported

- **WHEN** the declared route is imported
- **THEN** waypoint identities, altitude conversion, distance, and initial bearing
  match the vector

## Requirement: Layout and render ordering agree

### Scenario: A standard PFD is laid out and rendered

- **WHEN** the declared viewport and telemetry are rendered once
- **THEN** layout rectangles and enabled layer order match the vector

## Requirement: Drawing primitives perform observable work

### Scenario: Core primitives draw to a recording context

- **WHEN** attitude, compass, arc, marker, tape, and text primitives run
- **THEN** the expected canvas operation families are present and context state is
  balanced

## Requirement: Sensor models agree across languages

### Scenario: AHRS, ADC, and GPS vectors are evaluated

- **WHEN** TypeScript and Python realizations evaluate the declared device inputs
- **THEN** their unit-explicit solutions match the same expected records within the
  declared floating-point tolerance

### Scenario: Invalid sensor input is supplied

- **WHEN** a coordinate is out of range, a numeric input is non-finite, or an
  altimeter setting is non-positive
- **THEN** both realizations reject it instead of manufacturing telemetry

## Requirement: Radio receiver models agree across languages

### Scenario: A tuned station is inside its service volume

- **WHEN** TypeScript and Python ADF/DME realizations evaluate the same receiver and
  station records
- **THEN** station selection, bearing, great-circle distance, slant range,
  station-relative ground speed, and bounded signal strength match the shared vectors

### Scenario: No usable station matches

- **WHEN** the tuned frequency does not match a station or the receiver is outside its
  declared service volume
- **THEN** both realizations return an unavailable solution with empty station identity
  and zero signal instead of fabricated navigation data

### Scenario: Invalid radio geometry is supplied

- **WHEN** receiver coordinates, station coordinates, frequency, elevation, or service
  volume is non-finite or structurally invalid
- **THEN** both realizations reject it

## Requirement: Portable control models agree across languages

### Scenario: Marker and audio-panel state is evaluated

- **WHEN** TypeScript and Python realizations receive the same aircraft position,
  explicit marker-site catalog, source selection, volume, and signal inputs
- **THEN** marker priority, active lamps, and derived audio levels match the shared
  vectors

### Scenario: Transponder state advances

- **WHEN** both realizations normalize a squawk, apply a mode, trigger IDENT, and
  advance elapsed time
- **THEN** mode, code, IDENT state, and remaining duration match the shared vectors

### Scenario: Invalid control input is supplied

- **WHEN** marker radii are unordered, an audio level is outside zero through one, a
  squawk contains a non-octal digit, or elapsed time is invalid
- **THEN** both realizations reject it

## Requirement: Common SDK CI runs

### Scenario: Authority or realization changes

- **WHEN** this Component, vectors, protocol/rendering package, simulator adapter, or
  SDK workflow changes
- **THEN** avionics conformance runs independently of application tests
