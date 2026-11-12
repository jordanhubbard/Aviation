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

The retained application API requirements are specified in [General aviation API and MCP](../../docs/architecture/general-aviation-api.md).

### Requirement: Retained GA domain data is discoverable through HTTP and MCP

The retained planner SHALL expose weather, airport details and facilities, terrain,
GeoJSON mapping, aircraft references, navigation logs and performance/loading
calculations through typed HTTP operations. Meta App SHALL expose the same operations
through its MCP request tool and make their full schemas discoverable. Provider
provenance, unknown values and failures SHALL remain explicit; reference figures and
caller-supplied POH/loading data SHALL not become invented aircraft-specific results.

#### Scenario: An LLM discovers and calls a GA domain operation

- **WHEN** an integrating client requests the planner operation schema through MCP
- **THEN** it receives the typed public HTTP paths and input/output schemas
- **AND** invoking those paths through MCP returns the same domain data, provenance,
  missing-value semantics and error status as the corresponding HTTP operation
