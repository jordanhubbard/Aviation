---
namespace: aviation
version: 0.3.0
display_name: Aviation aircraft profiles
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.aircraft
    version: 0.3.0
    interface:
      uri: interfaces/aircraft.md
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
    uri: acceptance/aircraft.md
source_dependencies: []
---
# Aviation aircraft profiles

This Component owns portable aircraft identity, operating limits, dimensions, and
manufacturer-published reference profiles used by planning, simulation, and avionics
applications. It does not own aircraft state, physics integration, aircraft-specific
loading records, pilot operating decisions, presentation, persistence, or a substitute
for an aircraft's approved operating handbook.

The public surface is defined by `interfaces/aircraft.md`. Every realization must pass
`acceptance/aircraft.md` against `acceptance/vectors.json` without network access.

### Requirement: Applications share aircraft operating limits

Applications SHALL consume `aviation.aircraft` for bundled aircraft operating limits
and SHALL NOT maintain independent copies of those limits in displays or planners.

#### Scenario: G1000 renders the C172S airspeed tape

- **WHEN** the display derives its color arcs and never-exceed marker
- **THEN** it uses the bundled C172S operating profile while retaining scale layout,
  styling, trend rendering, and other presentation behavior as private code

### Requirement: Profiles are unit-explicit and internally ordered

Airspeed limits SHALL be finite positive knots indicated airspeed. Stall speed in the
landing configuration SHALL not exceed clean stall speed; clean stall speed SHALL be
below maneuvering speed; maneuvering speed SHALL not exceed maximum structural cruise
speed; maximum structural cruise speed SHALL be below never-exceed speed; and maximum
flap-extended speed SHALL be above landing-configuration stall speed and below
never-exceed speed.

#### Scenario: A malformed profile is loaded

- **WHEN** a required speed is non-positive, non-finite, or violates the declared
  ordering
- **THEN** construction fails before the profile reaches an application

### Requirement: Applications share aircraft identity and reference data

Bundled profiles SHALL carry one stable profile identifier and ICAO type designator,
unit-explicit fuel and weight limits, dimensions, and reference performance. Applications
SHALL resolve bundled selectors through the Component instead of maintaining private
copies of the same aircraft record.

#### Scenario: Flight Planner exports or initializes a C172S plan

- **WHEN** the application needs its bundled type designator, cruise reference, or usable
  fuel default
- **THEN** it derives those values from the C172S profile while retaining the user's
  selected speed, fuel burn, loading, and route policy as private application state

### Requirement: Published figures retain provenance

The C172S and C182T limitations come from their Cessna Pilot's Operating Handbooks.
The SR22 Perspective 3,600-pound limitations come from Cirrus POH 13772-004. Dimensions
and reference performance use the corresponding manufacturer specifications and approved
performance tables. Reference performance describes published sea-level comparison
conditions, not a dispatch calculation or guarantee for a particular aircraft.

#### Scenario: A bundled reference value is reviewed

- **WHEN** a fuel limit, dimension, weight limit, or reference-performance value changes
- **THEN** the acceptance vector remains traceable to the cited manufacturer or approved
  flight-manual source

- C172S POH: https://www.camarilloairport.com/downloads/N577ND_AFM-POH.pdf
- Skyhawk specifications: https://cessna.txtav.com/en/piston/cessna-skyhawk
- C182T NAV III POH: https://www.camarilloairport.com/downloads/N584LQ_AFM-POH.pdf
- Skylane specifications: https://cessna.txtav.com/en/piston/cessna-skylane
- SR22 Perspective 3,600-pound POH (P/N 13772-004):
  https://santamonicaflyers.com/wp-content/uploads/2021/02/SR22_POH.pdf
- SR22 specifications: https://cirrusaircraft.com/aircraft/sr-series/
