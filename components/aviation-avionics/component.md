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
exchange formats, AHRS/ADC/GPS device models, ADF/DME receiver models, display layout,
drawing primitives, marker-beacon geometry, audio-panel state, transponder state, and
deterministic PFD/MFD render pipelines. It does not own
simulator stepping, network connection lifecycle, frontend stores, application page
composition, radio hardware I/O, or physical-device I/O.

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

### Requirement: Radio receivers resolve declared navigation stations

ADF and DME calculations SHALL select the closest in-service station matching the tuned
frequency, compute great-circle or slant-range geometry with unit-explicit fields, and
derive bounded signal strength from the declared service volume. DME ground speed SHALL
be the absolute radial component of aircraft ground speed relative to the selected
station. Station catalogs SHALL remain explicit inputs so current navigation data can
be supplied independently of the receiver model. Invalid station geometry SHALL fail
closed, while an unmatched or out-of-range frequency SHALL produce an unavailable
solution with no invented identity.

#### Scenario: G1000 tunes a DME station

- **WHEN** the simulator supplies its position, altitude, tuning, and the shared
  navigation-data catalog
- **THEN** it delegates station selection and slant-range calculation to the common DME
  model rather than returning a fixed-zero app-private placeholder

### Requirement: Applications share portable avionics controls

Marker-beacon geometry, audio-panel source levels, squawk normalization, transponder
mode/state, and IDENT timing SHALL be deterministic and equivalent across TypeScript
and Python realizations. Marker-site catalogs SHALL remain explicit application inputs.
Invalid geometry, audio levels, squawk codes, modes, and elapsed time SHALL fail closed.

#### Scenario: G1000 operates the audio panel and transponder

- **WHEN** the simulator evaluates marker reception, derives audio levels, changes a
  squawk or mode, or advances IDENT timing
- **THEN** it delegates to the common avionics realization rather than an app-private
  model

### Requirement: Radio tuning and auxiliary audio state are portable

COM and NAV active/standby tuning, swap operations, volume, receive selection,
and COM PTT state SHALL be deterministic and equivalent across TypeScript and
Python. The training COM model uses 118.000 through 136.975 MHz in 0.025 MHz
steps; NAV uses 108.000 through 117.950 MHz in 0.050 MHz steps. Non-finite,
out-of-band, and off-channel frequencies SHALL fail closed. NAV SHALL reject
transmit commands. Intercom and music inputs SHALL share bounded volume and
boolean enable-state transitions. Explicit marker inputs SHALL resolve inner
before middle before outer. No model performs audio or radio hardware I/O.

#### Scenario: Flight Planner operates its radio stack

- **WHEN** the simulator tunes or swaps COM/NAV, changes PTT, or operates
  intercom, music, or marker lamps
- **THEN** it delegates state validation and transitions to the common avionics
  realization, retaining only application composition and elapsed-time policy
