# Aviation avionics acceptance contract

An independent oracle loads `vectors.json` and evaluates protocol and rendering cases
against the common packages. Acceptance does not open a network connection, browser,
simulator process, or physical avionics device.

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

## Requirement: Common SDK CI runs

### Scenario: Authority or realization changes

- **WHEN** this Component, vectors, protocol/rendering package, simulator adapter, or
  SDK workflow changes
- **THEN** avionics conformance runs independently of application tests
