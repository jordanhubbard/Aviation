---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "lang-python"
version: "1.0.0"
display_name: "Portable Python 3.11+"
primary_axis: "implementation.language-ecosystem"
target: "python"
secondary_constraints: []
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "implementation.language.python"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/python-portable-application/SKILL.md"
contributions:
  - contribution_id: "python-toolchain-constraint"
    kind: "toolchain"
    merge_operator: "exact-singleton"
    slot: "python"
    content:
      kind: "toolchain-constraint"
      uri: "toolchain.json"
  - contribution_id: "python-standard-command-profile"
    kind: "builder"
    merge_operator: "exact-singleton"
    slot: "standard-language-command"
    content:
      kind: "standard-command-profile"
      uri: "standard-command-profile.json"
conflicts:
  - "flavor://literate-ai/lang-cpp"
  - "flavor://literate-ai/lang-go"
co_requisites: []
order_before: []
order_after: []
---
# Portable Python 3.11+

Select this Flavor when the `implementation.language-ecosystem` axis should resolve to `python`. The referenced specification contains the exact generation policy contributed by this choice.
