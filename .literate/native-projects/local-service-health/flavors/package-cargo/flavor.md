---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "package-cargo"
version: "1.0.0"
display_name: "Cargo crate packaging"
primary_axis: "packaging"
target: "crates"
secondary_constraints:
  - axis: "implementation.language-ecosystem"
    value: "rust"
    optional: false
applicable_capabilities: []
provides:
  - name: "package.format.cargo"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "agent-skill"
    uri: "../../skills/agent/package-artifacts/SKILL.md"
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/rust-ecosystem/SKILL.md"
contributions:
  - contribution_id: "cargo-package-provider"
    kind: "packaging"
    merge_operator: "keyed-union"
    slot: "native-package-provider"
    content:
      kind: "packaging-policy"
      uri: "openspec/spec.md"
conflicts: []
co_requisites:
  - "flavor://literate-ai/lang-rust"
order_before: []
order_after: []
---
# Cargo crate packaging

Select this Flavor to construct a Cargo crate package from an exact accepted
Component artifact closure. It occupies the `packaging` axis and requires
`lang-rust`. It does not occupy `build.system`; `build-cargo` remains the Cargo
build-system Flavor (`+cargo`). Select `+package-cargo` or `+crates` for crate
packaging.
