# Aviation aircraft-profile acceptance contract

An independent oracle loads `vectors.json` and evaluates every profile against the
common SDK package. Acceptance does not contact a live aircraft, avionics device, or
external service.

## Requirement: Bundled operating profiles agree

### Scenario: The C172S profile is loaded

- **WHEN** the bundled profile is requested
- **THEN** its stable identity and all six unit-explicit airspeed limits match

## Requirement: Invalid profiles fail closed

### Scenario: A speed is invalid or limits are misordered

- **WHEN** each declared invalid mutation is applied to the valid profile
- **THEN** construction raises an explicit validation error

## Requirement: Common SDK CI runs

### Scenario: Authority or realization changes

- **WHEN** this Component, its vectors, a TypeScript or Python realization, package
  metadata, or the SDK workflow changes
- **THEN** aircraft-profile conformance runs independently of application tests
