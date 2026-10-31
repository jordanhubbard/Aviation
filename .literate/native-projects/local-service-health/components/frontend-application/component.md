---
namespace: literate-ai
version: 1.0.0
display_name: Front-end application
profiles:
  - application
  - frontend
sample: false
provides:
  - name: literate-ai.frontend-application
    version: 1.0.0
    interface: null
  - name: application.web-frontend
    version: 1.0.0
    interface: null
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/frontend-application/SKILL.md
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
  - slot_id: packages
    axis: packaging
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
# Front-end application

Reusable JavaScript page UI parent. Nested React and WebMCP skills are deltas of
this Component's pinned front-end skill. Selecting this Component without
JavaScript fails closed.

```mermaid
flowchart LR
    S["Page specification"] --> F["Front-end parent skill"]
    F --> R["React delta"]
    F --> W["WebMCP delta"]
```

## Application contract

| Concern | Decision |
| --- | --- |
| Kind | `web-application` |
| Language | JavaScript only (`application.web-frontend`) |
| UI framework | Optional `ui-react` |
| Packages | Optional lockfile-pinned npm via `package-npm` |

### Requirement: JavaScript language Flavor

The Component SHALL select `lang-javascript` on the language slot. A lock that
selects only a conflicting language Flavor SHALL fail closed.

#### Scenario: Python-only selection is rejected

- **WHEN** the language slot is filled with Python and no JavaScript Flavor is selected
- **THEN** the Component cannot lock because Python does not provide
  `application.web-frontend`
