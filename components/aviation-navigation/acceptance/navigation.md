# Aviation navigation acceptance contract

An independent oracle loads `vectors.json` and runs every supported realization. A
realization passes only when it supports every required operation represented by the
current vector schema and produces a finite result within the vector's absolute
tolerance.

## Requirement: Shared vectors agree

### Scenario: Exact arithmetic

- **WHEN** a vector declares zero tolerance
- **THEN** the realization returns exactly the declared scalar or tuple

### Scenario: Floating-point geodesy

- **WHEN** a vector declares a positive absolute tolerance
- **THEN** every scalar member differs from the expected value by no more than that
  tolerance

## Requirement: Coordinate and unit conventions are stable

### Scenario: Longitude crosses the anti-meridian

- **WHEN** longitude normalization receives a value outside `[-180, 180]`
- **THEN** the result is the equivalent longitude in `[-180, 180)`

### Scenario: One degree of equatorial longitude

- **WHEN** distance is calculated from `(0, 0)` to `(0, 1)`
- **THEN** the result is approximately 60.04 nautical miles

## Requirement: Invalid values fail closed

### Scenario: Non-positive speed is used as a divisor

- **WHEN** flight-time or fuel-required receives zero or negative ground speed
- **THEN** the binding reports failure and does not return a successful non-finite value

### Scenario: A coordinate is out of range

- **WHEN** a geodesic operation receives latitude outside `[-90, 90]` or longitude
  outside `[-180, 180]`
- **THEN** the binding reports failure rather than silently normalizing the coordinate

## Requirement: Every binding is independently exercised

### Scenario: Common SDK CI runs

- **WHEN** navigation authority, a realization, shared vectors, package metadata, or the
  SDK workflow changes
- **THEN** TypeScript, Python, and Go common-SDK jobs run independently and any failed or
  skipped required realization prevents a green workflow
