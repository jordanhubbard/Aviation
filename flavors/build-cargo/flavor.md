---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "build-cargo"
version: "1.0.0"
display_name: "Cargo build system"
primary_axis: "build.system"
target: "cargo"
secondary_constraints: []
applicable_capabilities: []
provides:
  - name: "build.policy.cargo"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/cargo-build-system/SKILL.md"
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/rust-ecosystem/SKILL.md"
contributions:
  - contribution_id: "cargo-standard-command-profile"
    kind: "builder"
    merge_operator: "exact-singleton"
    slot: "standard-build-system-command"
    content:
      kind: "standard-command-profile"
      uri: "standard-command-profile.json"
conflicts: []
co_requisites:
  - "flavor://literate-ai/lang-rust"
order_before: []
order_after: []
---
# Cargo build system

Select this Flavor for generated Rust applications that use Cargo packages, including
registry dependencies. The Standard lifecycle resolves one exact Cargo command, runs
`cargo metadata --locked` and `cargo build --locked` against `source/Cargo.toml`, places
all compiler output under its external object root, and exports the named binary without
modifying the admitted generated source tree.
