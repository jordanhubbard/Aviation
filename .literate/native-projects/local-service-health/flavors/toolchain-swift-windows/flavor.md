---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "toolchain-swift-windows"
version: "1.0.0"
display_name: "Windows Swift Toolchain"
primary_axis: "toolchain"
target: "swift-windows"
secondary_constraints:
  - axis: "platform.os"
    value: "windows"
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
  - contribution_id: "swift-windows-toolchain-constraint"
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
# Windows Swift Toolchain

This realization requires the supported native Windows Swift toolchain on `PATH`.
