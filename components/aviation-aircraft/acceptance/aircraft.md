# Aviation aircraft-profile acceptance contract

An independent oracle loads `vectors.json` and evaluates every profile against the
common SDK package. Acceptance does not contact a live aircraft, avionics device, or
external service.

## Requirement: Bundled operating profiles agree

### Scenario: A bundled profile is loaded

- **WHEN** the bundled profile is requested by stable ID or ICAO designator
- **THEN** its identity, operating limits, fuel and weight limits, dimensions, and
  published reference performance match

## Requirement: Application fleet identities fail closed

### Scenario: An application asks for reference data by manufacturer and model

- **WHEN** both identity fields match after case and repeated-whitespace normalization
- **THEN** the corresponding bundled profile is returned
- **AND WHEN** either field is blank, partial, or unknown
- **THEN** no profile is returned
- **AND** TypeScript and Python produce the same result for every identity vector

## Requirement: Invalid profiles fail closed

### Scenario: A profile field is invalid or limits are inconsistent

- **WHEN** each declared invalid mutation is applied to the valid profile
- **THEN** construction raises an explicit validation error

## Requirement: Common SDK CI runs

### Scenario: Authority or realization changes

- **WHEN** this Component, its vectors, a TypeScript or Python realization, package
  metadata, or the SDK workflow changes
- **THEN** aircraft-profile conformance runs independently of application tests
