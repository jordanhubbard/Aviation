---
namespace: literate-ai
version: 1.0.0
display_name: MCP application
profiles:
  - application
  - mcp
sample: false
provides:
  - name: literate-ai.mcp-application
    version: 1.0.0
    interface: null
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/mcp-application/SKILL.md
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
  - name: mcp
    kind: persistent-service
    path: mcp
acceptance_contracts: []
source_dependencies: []
---
# MCP application

Reusable MCP protocol parent. Nested WebMCP and embedded service MCP inherit this
Component's pinned MCP skill. Operator catalogs and project `mcps/` hygiene stay
distinct leaves.

## Application contract

| Concern | Decision |
| --- | --- |
| Protocol | MCP tools and resources |
| Leaves | operator catalog, project hygiene, embedded process MCP, WebMCP |

### Requirement: Product MCP is not an operator catalog

Generated MCP SHALL NOT require a personal operator catalog id as product
authority. Tools and resources SHALL use explicit schemas and structured errors.

#### Scenario: Invalid tool input is rejected

- **WHEN** a caller invokes a tool with input that fails the declared schema
- **THEN** the server returns a structured error and does not execute the tool
