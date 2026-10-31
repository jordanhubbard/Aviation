---
namespace: aviation
version: 0.1.0
display_name: Aviation hazard semantics
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.hazards
    version: 0.1.0
    interface:
      uri: interfaces/hazards.md
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
    uri: acceptance/hazards.md
source_dependencies: []
---
# Aviation hazard semantics

This Component owns provider-neutral SIGMET, AIRMET, and TFR record validation,
deterministic severity, inclusive effective-time and altitude overlap, exact planar
route-leg intersection, and stable route result ordering.

It does not own AWC or FAA response shapes, HTTP clients, credentials, retries,
provider availability policy, spherical/geodesic route construction, operational
decision making, or briefing presentation. Provider adapters translate external
records into this capability and applications present the result.

The public surface is defined by `interfaces/hazards.md`. Every realization must pass
`acceptance/hazards.md` against `acceptance/vectors.json` without network access.

### Requirement: Canonical records fail closed

Identifiers, kinds, and sub-types SHALL be trimmed and uppercased. Coordinates SHALL
be finite and within latitude/longitude bounds. Polygon rings SHALL contain at least
three distinct vertices. Effective instants and altitude bands SHALL be valid and
non-inverted. Invalid records SHALL be rejected rather than converted to a phantom
location.

#### Scenario: A provider supplies malformed geometry

- **WHEN** a coordinate is out of bounds or a polygon has fewer than three distinct
  vertices
- **THEN** normalization rejects the record with a stable validation code
- **AND** no point at an invented location is emitted

### Requirement: Common evaluations are deterministic

Effective windows and altitude bands SHALL include both endpoints. Polygon boundaries
and route contacts SHALL count as intersections. A route result SHALL be ordered first
by leg and then by hazard ingestion order, without mutating caller data.

#### Scenario: A short leg crosses a polygon edge

- **WHEN** neither endpoint nor the midpoint is inside but the leg crosses an edge
- **THEN** the hazard intersects the leg
- **AND** the result retains leg-major, ingestion-stable ordering

### Requirement: Provider adapters remain outside the portable contract

AWC and FAA GeoJSON parsers and network clients MAY use the shared normalization and
evaluation operations, but provider response details SHALL NOT become portable
Component inputs. No application behavior is invented merely to create a consumer.

#### Scenario: An AWC record is evaluated

- **WHEN** an AWC adapter receives a valid provider response
- **THEN** it translates the response into the provider-neutral record
- **AND** HTTP and provider-envelope behavior remain outside this Component
