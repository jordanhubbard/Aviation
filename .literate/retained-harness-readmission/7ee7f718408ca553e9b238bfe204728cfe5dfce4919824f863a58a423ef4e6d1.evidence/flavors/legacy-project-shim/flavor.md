---
schema: "literate-ai/flavor-markdown@1"
namespace: "legacy-adoption"
name: "build-legacy-shim"
version: "1.0.0"
display_name: "Qualified legacy build harness"
primary_axis: "build.system"
target: "legacy-shim"
secondary_constraints: []
applicable_capabilities:
  - "legacy.pipeline"
provides:
  - name: "build.policy.legacy-shim"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/legacy-project-shim/SKILL.md"
contributions: []
conflicts: []
co_requisites: []
order_before: []
order_after: []
---
# Qualified legacy build harness

Select this Flavor only for the Phase 1.1 wrapper Component.
