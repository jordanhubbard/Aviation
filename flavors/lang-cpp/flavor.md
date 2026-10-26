---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "lang-cpp"
version: "1.0.0"
display_name: "Portable C++17"
primary_axis: "implementation.language-ecosystem"
target: "cpp"
secondary_constraints: []
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "implementation.language.cpp"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/cpp17-portable-json-application/SKILL.md"
contributions:
  - contribution_id: "cpp-standard-command-profile"
    kind: "builder"
    merge_operator: "exact-singleton"
    slot: "standard-language-command"
    content:
      kind: "standard-command-profile"
      uri: "standard-command-profile.json"
conflicts:
  - "flavor://literate-ai/lang-go"
  - "flavor://literate-ai/lang-python"
co_requisites: []
order_before: []
order_after: []
---
# Portable C++17

Select this Flavor when the `implementation.language-ecosystem` axis should resolve to `cpp`. The referenced specification contains the exact generation policy contributed by this choice.
