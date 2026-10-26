---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "toolchain-swift-apple"
version: "1.0.0"
display_name: "Apple Swift Toolchain"
primary_axis: "toolchain"
target: "swift-apple"
secondary_constraints:
  - axis: "platform.os"
    value: "macos"
    optional: false
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "toolchain.swift"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "agent-skill"
    uri: "../../skills/agent/swift-toolchain-prerequisite/SKILL.md"
contributions:
  - contribution_id: "swift-apple-toolchain-constraint"
    kind: "toolchain"
    merge_operator: "exact-singleton"
    slot: "swift"
    content:
      kind: "toolchain-constraint"
      uri: "toolchain.json"
conflicts: []
co_requisites: []
order_before: []
order_after: []
---
# Apple Swift Toolchain

This realization probes Swift through `xcrun`, making the optional Apple developer-tools
installation an explicit, early host prerequisite.
