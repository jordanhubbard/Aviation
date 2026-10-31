---
namespace: aviation
version: 0.1.0
display_name: Aviation navigation
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.navigation
    version: 0.1.0
    interface:
      uri: interfaces/navigation.md
      pin: null
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-application-implementation/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-specification-planning/SKILL.md
workflow_definition:
  uri: workflows/production/staging/dev/workflow.md
routing_policy:
  uri: routing/production/staging/dev/routing.json
flavor_slots: []
entrypoints: []
acceptance_contracts:
  - kind: acceptance-contract
    uri: acceptance/navigation.md
source_dependencies: []
---
# Aviation navigation

This Component is the provider-neutral authority for reusable aviation navigation
arithmetic. It owns units, coordinate conventions, geodesic calculations, bearing and
heading semantics, wind triangles, time/speed/distance, fuel arithmetic, and standard
atmosphere performance-altitude and planning airspeed calculations. It does not own
calibrated air-data-computer sensor models, airport data, navaid or
procedure databases, weather acquisition, aircraft-specific limitations, presentation,
or persistence.

The public surface is defined by `interfaces/navigation.md`. Every language binding
must pass `acceptance/navigation.md` against the same vectors in
`acceptance/vectors.json`. Idiomatic language names may differ, but observable numeric
results and failures may not.

### Requirement: One navigation capability across applications

Applications SHALL consume `aviation.navigation` for behavior within this Component's
scope and SHALL NOT carry independent distance, bearing, coordinate, wind-triangle,
time/speed/distance, fuel, or standard-atmosphere implementations.

#### Scenario: An application needs great-circle distance

- **WHEN** an application calculates distance between two WGS-84 coordinates
- **THEN** it calls an `aviation.navigation` realization and does not own another
  haversine implementation

### Requirement: Bindings agree on units and conventions

Distances SHALL use nautical miles unless an operation explicitly names another unit;
speeds SHALL use knots; durations SHALL use hours; fuel flow SHALL use gallons per
hour; altitude SHALL use feet; pressure SHALL use inches of mercury; temperature SHALL
use degrees Celsius; headings SHALL be degrees clockwise from true north normalized to
the half-open interval `[0, 360)`; wind direction SHALL denote the direction from which
the wind originates.

#### Scenario: TypeScript and Python calculate the same route

- **WHEN** both bindings receive the same valid coordinates and operation
- **THEN** their finite results agree within the tolerance declared by the shared vector

### Requirement: Invalid navigation input fails closed

A realization SHALL reject non-finite numeric input, coordinates outside their declared
range, a non-positive divisor or speed, an impossible wind triangle, an unknown unit,
or an operation lacking required values. It SHALL NOT silently clamp invalid input or
return a successful `NaN` or infinity.

#### Scenario: Ground speed is zero

- **WHEN** flight time or fuel-required arithmetic receives zero ground speed
- **THEN** the realization returns a typed failure and no numeric result

### Requirement: Independent acceptance owns parity

Language-local unit tests may cover implementation detail, but promotion requires every
realization to execute the Component-owned vectors. A binding-specific test cannot
waive or replace a shared vector.

#### Scenario: A binding changes a formula

- **WHEN** its result falls outside a vector's tolerance
- **THEN** common SDK acceptance fails before an application build can make the change
  appear green
