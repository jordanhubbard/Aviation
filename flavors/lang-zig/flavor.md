---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "lang-zig"
version: "1.0.0"
display_name: "Portable Zig"
primary_axis: "implementation.language-ecosystem"
target: "zig"
secondary_constraints: []
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "implementation.language.zig"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/zig-portable-application/SKILL.md"
contributions:
  - contribution_id: "zig-toolchain-constraint"
    kind: "toolchain"
    merge_operator: "exact-singleton"
    slot: "zig"
    content:
      kind: "toolchain-constraint"
      uri: "toolchain.json"
  - contribution_id: "zig-standard-command-profile"
    kind: "builder"
    merge_operator: "exact-singleton"
    slot: "standard-language-command"
    content:
      kind: "standard-command-profile"
      uri: "standard-command-profile.json"
conflicts:
  - "flavor://literate-ai/lang-cpp"
  - "flavor://literate-ai/lang-go"
  - "flavor://literate-ai/lang-javascript"
  - "flavor://literate-ai/lang-python"
  - "flavor://literate-ai/lang-rust"
  - "flavor://literate-ai/lang-swift"
  - "flavor://literate-ai/lang-typescript"
co_requisites: []
order_before: []
order_after: []
---
# Portable Zig

Select this Flavor when the `implementation.language-ecosystem` axis should resolve to
`zig`. The referenced specification contains the exact generation policy contributed by
this choice. Pair with `toolchain-zig-cc` when Zig should also compile C or C++.
