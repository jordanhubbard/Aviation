---
namespace: legacy-adoption
version: 1.0.0
display_name: Legacy Project Pipeline Wrapper
profiles:
  - application
  - adoption-shim
sample: false
provides:
  - name: legacy.pipeline
    version: 1.0.0
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/legacy-project-shim/SKILL.md
workflow_definition: workflows/legacy-adoption/workflow.md
routing_policy: routing/legacy-adoption.json
flavor_slots:
  - slot_id: build-system
    axis: build.system
    cardinality: exactly-one
    capability_contract: legacy.pipeline
entrypoints:
  - name: run
    kind: portable-application
    path: litai.harness.mk
acceptance_contracts: []
source_dependencies: []
---
# Legacy Project Pipeline Wrapper

This Component exposes the quarantined project's proven pipeline through the
top-level `litai.harness.mk` boundary. Proven stages (direct baseline ran) are
`build`, `test`, `package`; recorded but not executed are none; missing stages are
none and fail loudly rather than becoming silent no-ops.

### Requirement: Preserve the direct baseline

Every proven wrapper stage SHALL exit successfully and produce the same observed
legacy-tree identity as the corresponding direct Phase 1 baseline stage recorded in
`.literate/legacy-harness-baseline.json`. Recorded stages that were not executed
(host-heavy or missing driver) have no baseline identity to match.

#### Scenario: Wrapper stage matches direct execution

- **WHEN** a proven stage is invoked through `litai.harness.mk`
- **THEN** its exit status and resulting legacy-tree identity match the direct baseline
