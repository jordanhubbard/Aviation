---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "package-brew"
version: "1.0.0"
display_name: "Homebrew packaging"
primary_axis: "packaging"
target: "brew"
secondary_constraints:
  - axis: "platform.os"
    value: "macos"
    optional: false
applicable_capabilities: []
provides:
  - name: "package.format.homebrew"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "agent-skill"
    uri: "../../skills/agent/package-artifacts/SKILL.md"
contributions:
  - contribution_id: "brew-package-provider"
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
# Homebrew packaging

Select this Flavor to construct a Homebrew package from an exact accepted Component artifact closure.
