---
namespace: aviation
version: 0.1.0
display_name: Aviation NOTAM semantics
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.notam
    version: 0.1.0
    interface:
      uri: interfaces/notam.md
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
    uri: acceptance/notam.md
source_dependencies: []
---
# Aviation NOTAM semantics

This Component owns provider-neutral NOTAM record normalization, deterministic
severity and category classification, inclusive effective-time checks, route relevance,
stable severity ordering, and conservative abbreviation expansion.

It does not own FAA or other provider HTTP clients, authentication, pagination, rate
limits, provider response envelopes, credential-free development fallback, persistence,
route construction, operational decision making, or briefing presentation. Provider
adapters translate external records into this capability and applications present the
result.

The public surface is defined by `interfaces/notam.md`. Every realization must pass
`acceptance/notam.md` against `acceptance/vectors.json` without network access.

### Requirement: Canonical records fail closed

Identifiers, types, locations, and facility types SHALL be trimmed and uppercased.
Effective instants SHALL be valid ISO-8601 timestamps, and the end SHALL NOT precede
the start. Records without an identifier, location, text, or valid effective window
SHALL be rejected rather than exposed as operational data.

#### Scenario: A provider record has mixed casing

- **WHEN** a valid record is normalized
- **THEN** its identity fields are canonical uppercase strings
- **AND** its severity and category are derived from normalized text

### Requirement: Classification is deterministic

Severity SHALL be one of `low`, `medium`, `high`, or `critical`. Category SHALL be one
of the declared portable labels. Keyword precedence SHALL be stable so the same text
cannot classify differently by language or insertion order.

#### Scenario: A runway is closed around an obstacle

- **WHEN** text contains both runway and closure/obstacle language
- **THEN** severity is `critical`
- **AND** category is `Runway`

### Requirement: Time and route filtering are explicit

Effective windows SHALL include both endpoints. Route filtering SHALL use an explicit
reference instant for deterministic operation, compare canonical ICAO prefixes, and
optionally include effective en-route records. Results SHALL retain ingestion order.

#### Scenario: An en-route notice is requested

- **WHEN** an effective `EN` record is not tied to a route airport
- **THEN** it is excluded by default
- **AND** included when the caller explicitly requests en-route records

### Requirement: Consumers use the shared semantics

Applications SHALL use `aviation.notam` for supported common record and classification
behavior. They MAY retain provider transport, application error policy, and briefing
format composition.

#### Scenario: Weather Briefing renders NOTAMs

- **WHEN** FAA records are fetched for a station
- **THEN** common parsing helpers and stable severity ordering come from the SDK
- **AND** the application retains network-failure wording and presentation layout
