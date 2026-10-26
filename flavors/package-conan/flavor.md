---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "package-conan"
version: "1.0.0"
display_name: "Conan packaging"
primary_axis: "packaging"
target: "conan"
secondary_constraints: []
applicable_capabilities: []
provides:
  - name: "package.format.conan"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "agent-skill"
    uri: "../../skills/agent/package-artifacts/SKILL.md"
contributions:
  - contribution_id: "conan-package-provider"
    kind: "packaging"
    merge_operator: "keyed-union"
    slot: "native-package-provider"
    content:
      kind: "packaging-policy"
      uri: "openspec/spec.md"
conflicts: []
co_requisites: []
order_before: []
order_after: []
---
# Conan packaging

Select this Flavor to construct a Conan package from an exact accepted Component artifact closure.
