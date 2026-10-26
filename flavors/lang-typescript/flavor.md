---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "lang-typescript"
version: "1.0.0"
display_name: "Portable TypeScript on Node.js 20+"
primary_axis: "implementation.language-ecosystem"
target: "typescript"
secondary_constraints: []
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "implementation.language.typescript"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/typescript-portable-application/SKILL.md"
contributions:
  - contribution_id: "node-toolchain-constraint"
    kind: "toolchain"
    merge_operator: "exact-singleton"
    slot: "node"
    content:
      kind: "toolchain-constraint"
      uri: "toolchain.json"
  - contribution_id: "typescript-standard-command-profile"
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
  - "flavor://literate-ai/lang-zig"
co_requisites: []
order_before: []
order_after: []
---
# Portable TypeScript on Node.js 20+

Select this Flavor when the `implementation.language-ecosystem` axis should resolve to
`typescript`. The referenced specification contains the exact generation policy
contributed by this choice.
