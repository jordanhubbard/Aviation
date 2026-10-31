---
namespace: aviation
version: 0.1.0
display_name: Aviation configuration registry
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.configuration
    version: 0.1.0
    interface:
      uri: interfaces/configuration.md
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
    uri: acceptance/configuration.md
source_dependencies: []
---
# Aviation configuration registry

This Component owns provider-neutral service/field definition validation, canonical
identity, catalog uniqueness, deterministic application scoping, lookup, and
required-field configuration status.

It does not own environment access, keystore access, secret persistence, HTTP settings
endpoints, React rendering, application defaults, or deployment-specific policy.
Those remain adapters and consumers around the portable registry.

### Requirement: Registry definitions fail closed

Service identifiers, field keys, environment names, and application scopes SHALL be
canonical. Categories SHALL come from the declared portable set. Required descriptive
fields and at least one application scope SHALL be present. Duplicate service IDs,
field keys, or environment names SHALL be rejected with stable error codes.

#### Scenario: A catalog contains ambiguous fields

- **WHEN** one service declares the same field key twice
- **THEN** catalog normalization rejects the definition
- **AND** no ambiguous service is exposed to consumers

### Requirement: Application scoping is deterministic

Application lookup SHALL trim and lowercase the requested identity, retain catalog
order, and include services explicitly scoped to that application plus global `all`
services. Lookup SHALL be case-insensitive through canonicalization.

#### Scenario: G1000 requests its services

- **WHEN** `g1000-simulator` is evaluated against the common catalog
- **THEN** its explicitly scoped services and global services are returned in catalog
  order

### Requirement: Configuration status reflects required fields

Field status SHALL preserve definition order. A service SHALL be configured when all
required fields are present; optional fields SHALL NOT make an otherwise configured
service incomplete. Presence inputs SHALL never expose secret values.

#### Scenario: SMTP has only its required server

- **WHEN** the server field is present and optional credentials are absent
- **THEN** SMTP is configured
- **AND** each optional field remains reported as not configured
