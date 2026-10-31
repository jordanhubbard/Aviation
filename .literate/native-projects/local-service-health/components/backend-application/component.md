---
namespace: literate-ai
version: 1.0.0
display_name: Back-end application
profiles:
  - application
  - service
sample: false
provides:
  - name: literate-ai.backend-application
    version: 1.0.0
    interface: null
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/mcp-application/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/backend-application/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/backend-application/python-service-application/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/backend-application/rust-service-application/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-specification-planning/SKILL.md
workflow_definition:
  uri: workflows/sample-host.md
routing_policy:
  uri: routing/sample-host.json
flavor_slots:
  - slot_id: language
    axis: implementation.language-ecosystem
    cardinality: exactly-one
    capability_contract: sample.portable-app
  - slot_id: os
    axis: platform.os
    cardinality: exactly-one
    capability_contract: sample.portable-app
  - slot_id: build-system
    axis: build.system
    cardinality: zero-or-one
    capability_contract: sample.portable-app
  - slot_id: toolchain
    axis: toolchain
    cardinality: zero-or-one
    capability_contract: sample.portable-app
entrypoints:
  - name: service
    kind: persistent-service
    path: service
acceptance_contracts: []
source_dependencies: []
---
# Back-end application

Reusable server-side parent. Language ecosystems are indexed off selected Flavors.
Nested `python-service-application` applies when Python is selected; nested
`rust-service-application` applies when Rust is selected. Unselected chapters stay
pinned on this Component and are omitted from the recipe.

## Application contract

| Concern | Decision |
| --- | --- |
| Kind | `persistent-service` |
| MCP leaf | Embedded process MCP (not WebMCP) |

### Requirement: Request paths stay local

The HTTP API and embedded MCP server SHALL answer from the local store. Only a
scheduled worker MAY call an expensive upstream source.

#### Scenario: One unit failure does not abort the worker

- **WHEN** the worker fails fetching one of several upstream units
- **THEN** it records that failure and continues the remaining units
