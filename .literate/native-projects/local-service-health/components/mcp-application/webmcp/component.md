---
namespace: literate-ai
version: 1.0.0
display_name: WebMCP page
profiles:
  - application
  - frontend
  - mcp
sample: false
provides:
  - name: literate-ai.webmcp
    version: 1.0.0
    interface: null
  - name: application.web-frontend
    version: 1.0.0
    interface: null
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/mcp-application/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/frontend-application/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/mcp-application/webmcp/SKILL.md
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
    capability_contract: application.web-frontend
  - slot_id: ui
    axis: implementation.ui-framework
    cardinality: zero-or-one
    capability_contract: application.web-frontend
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
  - name: page
    kind: web-application
    path: page
acceptance_contracts: []
source_dependencies: []
---
# WebMCP page

Nested WebMCP Component: in-page MCP tools on a JavaScript front-end. Inherits the
MCP parent skill and the front-end parent skill. Not a backend integration.

## Application contract

| Concern | Decision |
| --- | --- |
| Kind | `web-application` |
| Protocol | WebMCP (MCP in the page) |
| Language | JavaScript |

### Requirement: In-page tools reuse page logic

The Component SHALL register at least one WebMCP tool whose `execute` path updates
visible page state. Invalid tool input SHALL be rejected with a structured error
before actuation.

#### Scenario: Unknown tool input is structured

- **WHEN** a browser agent invokes the registered tool with a missing required field
- **THEN** the tool returns a structured error and the page remains usable
