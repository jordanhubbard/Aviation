---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "lang-javascript"
version: "1.0.0"
display_name: "Portable JavaScript on Node.js 20+"
primary_axis: "implementation.language-ecosystem"
target: "javascript"
secondary_constraints: []
applicable_capabilities:
  - "aviation.service.health"
provides:
  - name: "implementation.language.javascript"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/javascript-portable-json-application/SKILL.md"
contributions:
  - contribution_id: "node-toolchain-constraint"
    kind: "toolchain"
    merge_operator: "exact-singleton"
    slot: "node"
    content:
      kind: "toolchain-constraint"
      uri: "toolchain.json"
  - contribution_id: "javascript-standard-command-profile"
    kind: "builder"
    merge_operator: "exact-singleton"
    slot: "standard-language-command"
    content:
      kind: "standard-command-profile"
      uri: "standard-command-profile.json"
conflicts:
  - "flavor://literate-ai/lang-cpp"
  - "flavor://literate-ai/lang-python"
co_requisites: []
order_before: []
order_after: []
---
# Source-derived Javascript Flavor

This reviewed Flavor captures target-specific policy recovered from the source tree. Its referenced specification is the generation authority.
