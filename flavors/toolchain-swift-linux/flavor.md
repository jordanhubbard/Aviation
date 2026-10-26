---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "toolchain-swift-linux"
version: "1.0.0"
display_name: "Linux Swift Toolchain"
primary_axis: "toolchain"
target: "swift-linux"
secondary_constraints:
  - axis: "platform.os"
    value: "linux"
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
  - contribution_id: "swift-linux-toolchain-constraint"
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
# Linux Swift Toolchain

This realization requires a distribution-compatible Swift compiler on `PATH`.
