---
namespace: aviation
version: 0.1.0
display_name: Aviation navigation data
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.nav-data
    version: 0.1.0
    interface:
      uri: interfaces/nav-data.md
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
    uri: acceptance/nav-data.md
source_dependencies: []
---
# Aviation navigation data

This Component owns provider-neutral navaid, procedure, and airspace records;
normalization and ingestion validation; catalog query behavior; source provenance; and
effective-date freshness classification. It does not own airport identity, geodesic
calculations, route selection, avionics state, geospatial indexing, application
presentation, or pilot-in-command decisions.

Provider-specific adapters MAY translate OurAirports, openAIP, FAA CIFP, or other
external formats into this Component and the `aviation.airports` contract. They SHALL
not expose a second catalog, cache, search engine, proximity calculation, or procedure
selection implementation.

The public surface is defined by `interfaces/nav-data.md`. Every language binding must
pass `acceptance/nav-data.md` against `acceptance/vectors.json`.

### Requirement: Applications consume one navigation-data capability

Applications SHALL use `aviation.nav-data` for navaid and procedure normalization,
catalog query behavior, airspace ingestion, provenance, and freshness. Application
private code MAY own HTTP schemas, spatial indexes, route composition, and avionics
state, but SHALL NOT retain independent common navigation-data implementations.

#### Scenario: Two applications expose procedures

- **WHEN** Flight Planner and G1000 request procedures for the same airport
- **THEN** both delegate catalog selection and normalization to `aviation.nav-data`

### Requirement: Provenance and validity are explicit

Every ingested bundle SHALL carry a non-empty source identifier. Effective dates and a
cycle identifier MAY be supplied. Freshness SHALL be classified as `current`,
`expired`, `future`, or `undated` for an explicit reference time.

#### Scenario: A navigation cycle has ended

- **WHEN** the reference time is later than the inclusive effective-through instant
- **THEN** the bundle is classified as `expired`

### Requirement: Normalization is deterministic

Identifiers and procedure types SHALL be trimmed and uppercased. Coordinates SHALL be
finite and within geographic bounds. Procedure types SHALL be `SID`, `STAR`, or
`APPROACH`. Invalid records SHALL fail ingestion rather than silently entering a
catalog.

#### Scenario: A provider supplies lowercase identifiers

- **WHEN** a valid record is ingested
- **THEN** its identifiers and type are returned in canonical uppercase form

### Requirement: Independent acceptance owns parity

TypeScript and Python realizations SHALL execute the same Component-owned synthetic
vectors without network access or provider credentials.

#### Scenario: Query behavior changes

- **WHEN** either binding returns a different search or filtering result
- **THEN** common SDK CI fails independently of application tests

### Requirement: Provider adapters terminate at common contracts

Provider adapters SHALL emit `aviation.nav-data` bundles and, where applicable,
`aviation.airports` records. Adapter packages SHALL delegate validation and all query
behavior to those common SDK capabilities.

#### Scenario: Three provider formats are combined

- **WHEN** synthetic OurAirports CSV, openAIP GeoJSON, and FAA CIFP records are ingested
- **THEN** the resulting airports and navigation bundle pass the Component-owned adapter
  vectors without introducing a parallel database or search surface
