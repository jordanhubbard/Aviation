---
namespace: aviation
version: 0.1.0
display_name: Aviation logbook validation
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.logbook
    version: 0.1.0
    interface:
      uri: interfaces/logbook.md
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
    uri: acceptance/logbook.md
source_dependencies: []
---
# Aviation logbook validation

This Component owns portable normalization and consistency checks for common pilot
logbook duration fields. It provides deterministic, cross-language treatment of PIC,
dual-received, and solo overlap; student-pilot restrictions; day/night and instrument
totals; pilot-role normalization; and night-landing consistency.

The Component does not determine whether a flight may legally be logged under a
particular certificate, operation, jurisdiction, or regulation. It does not own CSV or
provider parsing, corrupt-row repair, user certification records, aircraft or airport
adaptation, route-text inference, distance-based certificate advice, persistence,
statistics presentation, or dashboard policy.

The public surface is defined by `interfaces/logbook.md`. Every realization must pass
`acceptance/logbook.md` against `acceptance/vectors.json` without network access.

### Requirement: Common logbook duration semantics are shared

Applications SHALL use `aviation.logbook` when validating the supported common
duration fields and SHALL NOT maintain independent PIC/dual/solo overlap arithmetic.
Every duration is expressed in decimal hours and every landing count is an integer.

#### Scenario: A certificated pilot receives instruction while acting as PIC

- **WHEN** PIC time and dual-received time both equal total flight time within the
  declared tolerance
- **THEN** the entry is time-accountable because those categories may overlap
- **AND** solo time that is already contained within PIC time is not added twice

#### Scenario: A student pilot records a solo flight

- **WHEN** the student has solo time, no dual-received time, and no PIC time
- **THEN** solo time accounts for the flight
- **AND WHEN** student status accompanies PIC time
- **THEN** validation reports the qualified student/PIC conflict

### Requirement: Validation is deterministic and fail closed

The validator SHALL normalize role text by trimming and uppercasing, reject unsupported
roles, reject non-finite or negative durations and non-integer or negative landing
counts, and use an explicit non-negative tolerance. Results SHALL contain stable issue
codes, severities, field names, and messages in deterministic order.

#### Scenario: A PIC role omits a redundant PIC duration

- **WHEN** a positive-time PIC entry carries zero PIC and dual-received time
- **THEN** the normalized PIC duration equals total time
- **AND** the caller's input object is not mutated

#### Scenario: Instrument or condition time is inconsistent

- **WHEN** actual plus simulated instrument time exceeds total time
- **OR WHEN** both day and night are present but their sum differs from total beyond
  tolerance
- **THEN** validation reports the corresponding structured issue

### Requirement: Application policy remains outside the Component

Consumers SHALL adapt their private models to the portable input and decide how to
present structured issues. The Component SHALL NOT parse free-form remarks or infer
intermediate stops, registration jurisdiction, provider corruption, or certificate
eligibility from distances.

#### Scenario: ForeFlight Dashboard validates an imported row

- **WHEN** a parsed application entry is checked
- **THEN** common duration and role checks come from `aviation.logbook`
- **AND** ForeFlight CSV parsing and repair, aircraft/airport validation, route-text
  heuristics, account state, provider response shapes, and presentation remain private

