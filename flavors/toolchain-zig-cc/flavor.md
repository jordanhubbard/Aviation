---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "toolchain-zig-cc"
version: "1.0.0"
display_name: "Zig as C/C++ compiler"
primary_axis: "toolchain"
target: "zig-cc"
secondary_constraints: []
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "toolchain.zig-cc"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs: []
contributions:
  - contribution_id: "zig-cc-toolchain-constraint"
    kind: "toolchain"
    merge_operator: "exact-singleton"
    slot: "zig-cc"
    content:
      kind: "toolchain-constraint"
      uri: "toolchain.json"
conflicts: []
co_requisites: []
order_before: []
order_after: []
---
# Zig as C/C++ compiler

Select this Flavor when the `toolchain` axis should resolve to Zig's `zig cc` / `zig
c++` driver. It is independent of `lang-zig`: a C or C++ Component may select this
toolchain without selecting the Zig language Flavor.
