---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "package-npm"
version: "1.0.0"
display_name: "npm packaging"
primary_axis: "packaging"
target: "npm"
secondary_constraints:
  - axis: "implementation.language-ecosystem"
    value: "javascript"
    optional: false
applicable_capabilities: []
provides:
  - name: "package.format.npm"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "agent-skill"
    uri: "../../skills/agent/package-artifacts/SKILL.md"
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/javascript-ecosystem/SKILL.md"
contributions:
  - contribution_id: "npm-toolchain-constraint"
    kind: "toolchain"
    merge_operator: "exact-singleton"
    slot: "npm"
    content:
      kind: "toolchain-constraint"
      uri: "toolchain.json"
  - contribution_id: "npm-standard-command-profile"
    kind: "builder"
    merge_operator: "exact-singleton"
    slot: "standard-package-command"
    content:
      kind: "standard-command-profile"
      uri: "standard-command-profile.json"
  - contribution_id: "npm-package-provider"
    kind: "packaging"
    merge_operator: "keyed-union"
    slot: "native-package-provider"
    content:
      kind: "packaging-policy"
      uri: "openspec/spec.md"
conflicts: []
co_requisites:
  - "flavor://literate-ai/lang-javascript"
order_before: []
order_after: []
---
# npm packaging

Select this Flavor to admit a lockfile-pinned npm dependency closure in generated
JavaScript and to select the npm packaging policy for an exact accepted Component
artifact closure. The current Standard lifecycle replays and retains dependencies; it
does not yet construct or publish a registry package. This Flavor occupies the
`packaging` axis and requires `lang-javascript`. It does not occupy
`implementation.language-ecosystem`. Host installation and Standard npm discovery
consume this Flavor's toolchain constraint as the only npm version authority; the
host SBOM records the same `>=9,<13` range.
