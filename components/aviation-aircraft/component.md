---
namespace: aviation
version: 0.1.0
display_name: Aviation aircraft profiles
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.aircraft
    version: 0.1.0
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

This Component owns portable aircraft identity and operating-limit profiles used by
planning, simulation, and avionics applications. It does not own aircraft state,
physics integration, pilot operating decisions, presentation, persistence, or a
substitute for an aircraft's approved operating handbook.

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
