---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "package-pip"
version: "1.0.0"
display_name: "pip wheel packaging"
primary_axis: "packaging"
target: "pip"
secondary_constraints:
  - axis: "implementation.language-ecosystem"
    value: "python"
    optional: false
applicable_capabilities: []
provides:
  - name: "package.format.python-wheel"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "agent-skill"
    uri: "../../skills/agent/package-artifacts/SKILL.md"
contributions:
  - contribution_id: "pip-package-provider"
    kind: "packaging"
    merge_operator: "keyed-union"
    slot: "native-package-provider"
    content:
      kind: "packaging-policy"
      uri: "openspec/spec.md"
conflicts: []
co_requisites:
  - "flavor://literate-ai/lang-python"
order_before: []
order_after: []
---
# pip wheel packaging

Select this Flavor to construct a Python wheel from an exact accepted Component artifact
closure. It occupies the `packaging` axis and requires `lang-python`.
