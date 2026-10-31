---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "lang-elixir"
version: "1.0.0"
display_name: "Portable Elixir on Erlang/OTP"
primary_axis: "implementation.language-ecosystem"
target: "elixir"
secondary_constraints: []
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "implementation.language.elixir"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/elixir-portable-application/SKILL.md"
contributions:
  - contribution_id: "elixir-toolchain-constraint"
    kind: "toolchain"
    merge_operator: "exact-singleton"
    slot: "elixir"
    content:
      kind: "toolchain-constraint"
      uri: "toolchain.json"
  - contribution_id: "elixir-standard-command-profile"
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
  - "flavor://literate-ai/lang-zig"
co_requisites: []
order_before: []
order_after: []
---
# Portable Elixir on Erlang/OTP

Select this Flavor when the `implementation.language-ecosystem` axis should resolve to
`elixir`. The referenced specification contains the exact generation policy contributed by
this choice.
