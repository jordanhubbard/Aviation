---
namespace: aviation
version: 0.1.0
display_name: Aviation airports
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.airports
    version: 0.1.0
    interface:
      uri: interfaces/airports.md
      pin: null
requires:
  - requirement_id: navigation-distance
    capability: aviation.navigation
    version_range: ">=0.1,<1"
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
    uri: acceptance/airports.md
source_dependencies: []
---
# Aviation airports

This Component owns the provider-neutral airport identity, normalized record, lookup,
search, proximity, and field-elevation contract. It does not own source-specific
ingestion, navaids, procedures, airspace, route planning, application presentation, or
flight-analysis heuristics.

The public surface is defined by `interfaces/airports.md`. Every language binding must
pass `acceptance/airports.md` against `acceptance/vectors.json`.

### Requirement: Applications consume one airport capability

Applications SHALL use `aviation.airports` for airport data discovery, normalization,
code lookup, search, and proximity behavior. Application-private code MAY retain a
specialized index or cache only when it consumes normalized SDK records and serves an
application-specific performance or orchestration need.

#### Scenario: Flight analysis needs vectorized nearest-field lookup

- **WHEN** a flight analyzer builds a batch spatial index
- **THEN** it builds that index from normalized `aviation.airports` records rather than
  owning another dataset loader or airport schema

### Requirement: Airport records have stable semantics

ICAO and IATA codes SHALL be uppercase. Coordinates SHALL be finite WGS-84 decimal
degrees. Elevation, when present, SHALL be finite feet above mean sea level. Missing
elevation SHALL remain missing and SHALL NOT be converted to zero.

#### Scenario: An airport has no published elevation

- **WHEN** its source record omits elevation
- **THEN** the normalized record has no numeric elevation value

### Requirement: Lookup and proximity agree across bindings

Code lookup SHALL be case-insensitive and SHALL support ICAO, IATA, and the established
US `K`-prefix alias. Proximity distances SHALL be nautical miles and sorted nearest
first. Search results SHALL be deterministic for the same normalized dataset.

#### Scenario: An IATA code is used

- **WHEN** a caller looks up `alp` in the acceptance dataset
- **THEN** every binding returns airport `KAAA`

### Requirement: Invalid source records fail closed

Normalization SHALL omit records without a usable ICAO identity or with non-finite or
out-of-range coordinates. It SHALL NOT expose a successful record containing invalid
coordinates.

#### Scenario: Latitude is out of range

- **WHEN** a source record has latitude 91
- **THEN** the record is absent from normalized lookup and search results

### Requirement: Data provenance remains explicit

Bundled datasets and provider adapters SHALL document their source, license, generation
date or revision, and refresh procedure before they become Component-owned assets. A
copied cache is retained implementation data until that evidence is complete.

#### Scenario: The bundled cache is refreshed

- **WHEN** a new cache is proposed
- **THEN** its provenance and deterministic normalization tests are reviewed with the
  change
