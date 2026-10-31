---
namespace: aviation
version: 0.1.0
display_name: Aviation weight and balance
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.weight-balance
    version: 0.1.0
    interface:
      uri: interfaces/weight-balance.md
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
    uri: acceptance/weight-balance.md
source_dependencies: []
---
# Aviation weight and balance

This Component owns reusable aircraft loading arithmetic: station moments, fuel loading
and burn, center of gravity, linear envelope interpolation, maximum gross checks, and
takeoff/landing loading conditions. Aircraft records, pilot-entered profiles,
presentation, persistence, and go/no-go decisions remain application policy.

The public surface is defined by `interfaces/weight-balance.md`. Every realization
must pass `acceptance/weight-balance.md` against the Component-owned vectors in
`acceptance/vectors.json`.

### Requirement: Applications consume one loading calculation

Applications SHALL consume `aviation.weight-balance` for calculations within this
Component's scope and SHALL NOT retain independent station, moment, CG, fuel-burn, or
envelope-interpolation formulas.

#### Scenario: A preflight application evaluates takeoff and landing

- **WHEN** it receives an aircraft profile, station loads, takeoff fuel, and planned burn
- **THEN** it obtains both conditions from the common capability

### Requirement: Invalid loading fails closed

A realization SHALL reject non-finite values, non-positive aircraft weights or fuel
density, negative loads or fuel, mismatched station arrays, and fuel burn greater than
fuel loaded. It SHALL NOT return a successful non-finite result.

#### Scenario: Planned burn exceeds takeoff fuel

- **WHEN** planned burn is greater than loaded fuel
- **THEN** calculation fails without producing takeoff or landing conditions

### Requirement: Limits remain aircraft data

The capability SHALL interpolate the supplied envelope without inventing aircraft
limits. A weight outside the supplied envelope is an explicit problem even when it is
below the separately supplied maximum gross weight.

#### Scenario: Calculated weight is outside entered rows

- **WHEN** a takeoff or landing weight is outside the supplied envelope range
- **THEN** the condition has no limits and reports an out-of-envelope problem
