---
namespace: aviation
version: 0.1.0
display_name: Aviation flight dynamics
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.flight-dynamics
    version: 0.1.0
    interface:
      uri: interfaces/flight-dynamics.md
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
    uri: acceptance/flight-dynamics.md
source_dependencies: []
---
# Aviation flight dynamics

This Component owns deterministic atmosphere, environmental wind, scalar force,
rigid-body integration, aircraft performance, aircraft-model validation, and
autopilot-control primitives. It does not own avionics display state, HTTP schemas,
alert presentation, route planning, recorded-flight analytics, or operational pilot
decisions.

The public surface is defined by `interfaces/flight-dynamics.md`. Every realization
must pass `acceptance/flight-dynamics.md` against `acceptance/vectors.json` without
network access.

### Requirement: Applications share physics primitives

Applications SHALL delegate common force, atmosphere, wind, performance, aircraft
model, integration, and PID behavior to `aviation.flight-dynamics`. Application code
MAY retain simulation orchestration, avionics modes, alert routing, persistence, and
presentation, but SHALL NOT maintain independent copies of common formulas.

#### Scenario: Flight Planner updates its legacy state

- **WHEN** the compatibility service calculates forces, wind effects, or PID output
- **THEN** those calculations execute through `aviation.flight-dynamics`

#### Scenario: G1000 updates its simulator and avionics state

- **WHEN** the simulator loads its C172 performance or updates a bounded PID loop
- **THEN** the model data and controller calculation execute through
  `aviation.flight-dynamics` while avionics modes and presentation remain private

### Requirement: Calculations are deterministic and unit-explicit

Public records and operations SHALL identify their units. Given the same model,
environment, controls, time step, and initial state, a realization SHALL return the
same result within the acceptance tolerance.

#### Scenario: A sea-level atmosphere is evaluated

- **WHEN** the standard ISA configuration is evaluated at zero metres
- **THEN** pressure, temperature, and density match the declared vector

### Requirement: Invalid physical inputs fail closed

Mass, density, pressure, time steps, and bounded control inputs SHALL be validated.
Invalid values SHALL raise an explicit error instead of entering the simulation.

#### Scenario: A throttle command exceeds its range

- **WHEN** a control record contains throttle greater than one
- **THEN** construction fails before force or integration calculations run

### Requirement: Aircraft models are validated assets

Bundled aircraft models SHALL declare stable identifiers and pass structural and
physical consistency validation. A model warning MAY be retained only when it is
explicit in the acceptance vector; validation errors SHALL fail common SDK CI.

#### Scenario: Bundled general-aviation models are loaded

- **WHEN** C172, C182, and SR22 configurations are validated
- **THEN** their identifiers and declared error/warning counts match the vector
