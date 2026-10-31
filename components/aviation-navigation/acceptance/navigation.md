# Aviation navigation acceptance contract

An independent oracle loads `vectors.json` and runs every supported realization. A
realization passes only when it supports every required operation represented by the
current vector schema and produces a finite result within the vector's absolute
tolerance.

## Requirement: Shared vectors agree

### Scenario: Exact arithmetic

- **WHEN** a vector declares zero tolerance
- **THEN** the realization returns exactly the declared scalar or tuple

### Scenario: Configurable route reserve

- **WHEN** a route planner supplies fuel flow and an arbitrary reserve duration
- **THEN** every realization returns the same reserve gallons

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

### Scenario: Wind direction uses the aviation from convention

- **WHEN** wind components and a corrected heading are calculated
- **THEN** headwind is positive when wind comes from ahead, crosswind is positive from
  the right, and ground speed is the positive along-course solution

### Scenario: Wind velocity vectors preserve component signs

- **WHEN** east/north wind velocity is projected onto a selected course
- **THEN** wind moving toward the aircraft is a positive headwind and wind moving from
  its right is a positive crosswind

### Scenario: Local projection is reversible

- **WHEN** a coordinate near an origin is projected to east/north metres and inverted
- **THEN** every realization uses the WGS-84 semi-major axis and recovers the original
  coordinate within the declared tolerance

### Scenario: Heading wrap and runway numbering agree

- **WHEN** headings cross north or lie on a runway-number rounding tie
- **THEN** every realization returns the same signed delta, circular mean, and
  two-digit runway designator

## Requirement: Invalid values fail closed

### Scenario: Performance altitudes agree across bindings

- **WHEN** pressure altitude, ISA temperature, or density altitude is requested
- **THEN** every realization applies the same standard datum, lapse rate, units, and
  temperature-deviation approximation

### Scenario: Planning airspeed conversions agree across bindings

- **WHEN** IAS is converted to TAS or TAS is converted to or from Mach
- **THEN** every realization applies the same ISA temperature, units, approximation,
  and fail-closed numeric domain

### Scenario: Non-positive speed is used as a divisor

- **WHEN** flight-time or fuel-required receives zero or negative ground speed
- **THEN** the binding reports failure and does not return a successful non-finite value

### Scenario: A coordinate is out of range

- **WHEN** a geodesic operation receives latitude outside `[-90, 90]` or longitude
  outside `[-180, 180]`
- **THEN** the binding reports failure rather than silently normalizing the coordinate

### Scenario: Altimeter setting is not positive

- **WHEN** pressure altitude receives a zero or negative altimeter setting
- **THEN** the binding reports failure rather than returning a numeric altitude

### Scenario: The requested course cannot be maintained

- **WHEN** crosswind exceeds true airspeed or the along-course solution is not positive
- **THEN** the binding reports failure rather than returning `NaN` or a misleading speed

### Scenario: Airspeed or Mach is negative

- **WHEN** an IAS, TAS, or Mach conversion receives a negative speed or Mach value
- **THEN** the binding reports failure rather than returning a negative or non-finite result

### Scenario: Local geometry has no defined answer

- **WHEN** a projection origin is a pole, an inverse leaves the latitude domain, or a
  circular sample is empty or directionally ambiguous
- **THEN** the binding reports failure rather than returning an arbitrary direction or
  non-finite coordinate

## Requirement: Every binding is independently exercised

### Scenario: Common SDK CI runs

- **WHEN** navigation authority, a realization, shared vectors, package metadata, or the
  SDK workflow changes
- **THEN** TypeScript, Python, and Go common-SDK jobs run independently and any failed or
  skipped required realization prevents a green workflow
