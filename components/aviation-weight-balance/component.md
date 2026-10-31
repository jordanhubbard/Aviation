---
namespace: aviation
version: 0.2.0
display_name: Aviation weight and balance
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.weight-balance
    version: 0.2.0
    interface:
      uri: interfaces/weight-balance.md
      pin: null
requires:
  - requirement_id: aircraft-profile-link
    capability: aviation.aircraft
    version_range: ">=0.2,<1"
    dependency_kind: runtime
    optional: false
    constraints: []
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

This Component owns reusable aircraft loading arithmetic and qualified loading profiles:
station moments, fuel loading and burn, center of gravity, linear envelope interpolation,
station/group limits, maximum gross checks, and takeoff/landing loading conditions.
Aircraft operating identity comes from `aviation.aircraft`; current airframe empty-weight
records, entered loads, presentation, persistence, and go/no-go decisions remain
application policy.

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

### Requirement: Loading profiles link to aircraft identity

Every bundled loading profile SHALL name its `aviation.aircraft` profile. Shared weight
and usable-fuel limits SHALL agree with that linked profile. Station arms, station and
group limits, fuel density, and CG envelopes SHALL retain their loading-authority
provenance.

#### Scenario: The C172S sample profile is loaded

- **WHEN** the profile is resolved by loading-profile ID or aircraft-profile ID
- **THEN** it identifies `cessna-172s`, agrees with its 2550-pound and 53-gallon limits,
  and supplies the handbook station, baggage, fuel-arm, and normal-category envelope data

### Requirement: Sample empty-aircraft data is not operational authority

The bundled C172S empty weight and moment are the handbook's sample loading values. They
SHALL be labeled as sample data and SHALL NOT be represented as the current record for a
particular airplane. An application MAY initialize a demonstration from the sample but
MUST retain any actual airframe record and entered station/fuel loads as application state.

#### Scenario: G1000 Trip Planning edits a station load

- **WHEN** a user changes an occupant, baggage, or fuel value
- **THEN** the application retains that value in its own state and passes it to the common
  calculation without mutating the shared C172S profile

The C172S profile is traceable to the Cessna Model 172S NAV III Pilot's Information
Manual, Section 2 (approved CG limits) and Section 6 (sample loading problem and loading
arrangements):
https://cessnaflighttraining.kingschools.com/secure/ccf/ccfppv1/documents/172S_PIM.pdf
