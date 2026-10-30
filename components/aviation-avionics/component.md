---
namespace: aviation
version: 0.1.0
display_name: Aviation avionics
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.avionics
    version: 0.1.0
    interface:
      uri: interfaces/avionics.md
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
    uri: acceptance/avionics.md
source_dependencies: []
---
# Aviation avionics

This Component owns portable avionics telemetry and command contracts, flight-plan
exchange formats, AHRS/ADC/GPS device models, display layout, drawing primitives, and
deterministic PFD/MFD render pipelines. It does not own simulator stepping, network
connection lifecycle, frontend stores, application page composition, physical-device
I/O, or unqualified radio models.

The public surface is defined by `interfaces/avionics.md`. TypeScript realizations must
pass `acceptance/avionics.md` against `acceptance/vectors.json` without network access
or a browser.

### Requirement: Applications share avionics wire contracts

Applications SHALL import telemetry, command, and flight-plan records and validators
from `aviation.avionics`. They SHALL NOT maintain a structurally independent telemetry
schema or full-snapshot validator.

#### Scenario: G1000 receives telemetry

- **WHEN** the simulator frontend classifies a telemetry payload
- **THEN** it uses the common protocol guard and shared record types

### Requirement: Rendering is deterministic and host-independent

Layout calculations and render ordering SHALL be deterministic for the same viewport,
theme, telemetry, and timestamp. Drawing primitives SHALL use only the supplied canvas
context and SHALL be testable through an operation-recording context.

#### Scenario: A PFD viewport is laid out

- **WHEN** the declared viewport is passed to the common layout function
- **THEN** each instrument viewport matches the acceptance vector

### Requirement: Invalid protocol data fails closed

Runtime guards SHALL reject incomplete full snapshots, invalid partial updates,
unknown commands, and malformed flight plans rather than casting them into authority.

#### Scenario: A telemetry number is not finite

- **WHEN** a snapshot contains a non-finite numeric field
- **THEN** the common snapshot guard rejects it

### Requirement: Applications share deterministic sensor models

AHRS, ADC, and GPS calculations SHALL be pure, unit-explicit, deterministic for the
same inputs, and equivalent across TypeScript and Python realizations. Invalid
coordinates, non-finite values, and non-positive altimeter settings SHALL fail closed.

#### Scenario: G1000 and Flight Planner compute air data

- **WHEN** either application needs pressure altitude, density altitude, temperature,
  or true airspeed
- **THEN** it delegates to the common ADC realization rather than an app-local model
