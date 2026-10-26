---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "package-winget"
version: "1.0.0"
display_name: "WinGet packaging"
primary_axis: "packaging"
target: "winget"
secondary_constraints:
  - axis: "platform.os"
    value: "windows"
    optional: false
applicable_capabilities: []
provides:
  - name: "package.format.winget"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "agent-skill"
    uri: "../../skills/agent/package-artifacts/SKILL.md"
contributions:
  - contribution_id: "winget-package-provider"
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
# WinGet packaging

Select this Flavor to construct a WinGet package from an exact accepted Component artifact closure.
