---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "lang-swift"
version: "1.0.0"
display_name: "Portable Swift"
primary_axis: "implementation.language-ecosystem"
target: "swift"
secondary_constraints: []
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "implementation.language.swift"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/swift-portable-json-application/SKILL.md"
contributions:
  - contribution_id: "swift-standard-command-profile"
    kind: "builder"
    merge_operator: "exact-singleton"
    slot: "standard-language-command"
    content:
      kind: "standard-command-profile"
      uri: "standard-command-profile.json"
conflicts:
  - "flavor://literate-ai/lang-cpp"
  - "flavor://literate-ai/lang-javascript"
  - "flavor://literate-ai/lang-python"
  - "flavor://literate-ai/lang-rust"
co_requisites: []
co_requisite_groups:
  - group_id: "swift-host-toolchain"
    alternatives:
      - "flavor://literate-ai/toolchain-swift-apple"
      - "flavor://literate-ai/toolchain-swift-linux"
      - "flavor://literate-ai/toolchain-swift-windows"
order_before: []
order_after: []
---
# Portable Swift

This Flavor owns portable Swift source conventions. Exactly one selected host-toolchain
realization owns discovery and mitigation for the selected operating system.
