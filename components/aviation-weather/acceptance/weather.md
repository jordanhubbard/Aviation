# Aviation weather acceptance contract

An independent oracle loads `vectors.json` and runs every synthetic case against each
required binding. Acceptance never contacts an external weather provider.

## Requirement: METAR parsing agrees

### Scenario: Common observation fields are normalized

- **WHEN** a METAR contains gusting wind, fractional visibility, temperature, and
  multiple ceiling layers
- **THEN** every binding returns the same normalized fields and lowest ceiling

### Scenario: Variable wind remains directionless

- **WHEN** a METAR reports `VRB`
- **THEN** direction is absent while speed is retained

## Requirement: Categories and warnings agree

### Scenario: Threshold boundaries are stable

- **WHEN** the shared visibility and ceiling cases are classified
- **THEN** every binding returns the declared category

### Scenario: Operational warnings are deterministic

- **WHEN** visibility, ceiling, and wind cross warning thresholds
- **THEN** every binding returns identical warning text in identical order

## Requirement: Provider normalization agrees

### Scenario: OpenWeatherMap data is converted

- **WHEN** a synthetic provider payload is normalized
- **THEN** units, rounding, airport identity, conditions, and missing METAR agree

## Requirement: Common SDK CI runs

### Scenario: Weather authority or a realization changes

- **WHEN** this Component, its vectors, a binding, package metadata, or the SDK workflow
  changes
- **THEN** the TypeScript and Python conformance adapters run independently
