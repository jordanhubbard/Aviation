---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "package-apt"
version: "1.0.0"
display_name: "Debian apt packaging"
primary_axis: "packaging"
target: "apt"
secondary_constraints:
  - axis: "platform.os"
    value: "linux"
    optional: false
applicable_capabilities: []
provides:
  - name: "package.format.deb"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "agent-skill"
    uri: "../../skills/agent/package-artifacts/SKILL.md"
contributions:
  - contribution_id: "apt-package-provider"
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
# Debian apt packaging

Select this Flavor to construct a Debian package from an exact accepted Component artifact closure.
