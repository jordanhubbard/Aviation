---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "build-mix"
version: "1.0.0"
display_name: "Mix build system"
primary_axis: "build.system"
target: "mix"
secondary_constraints: []
applicable_capabilities: []
provides:
  - name: "build.policy.mix"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/mix-build-system/SKILL.md"
contributions:
  - contribution_id: "mix-standard-command-profile"
    kind: "builder"
    merge_operator: "exact-singleton"
    slot: "standard-build-system-command"
    content:
      kind: "standard-command-profile"
      uri: "standard-command-profile.json"
  - contribution_id: "hex-constraint"
    kind: "toolchain"
    merge_operator: "exact-singleton"
    slot: "hex"
    content:
      kind: "toolchain-constraint"
      uri: "hex.json"
conflicts: []
co_requisites:
  - "flavor://literate-ai/lang-elixir"
order_before: []
order_after: []
---
# Mix build system

Select this Flavor for Elixir applications and libraries with declarative Mix
project intent. Generate `source/mix-project.json`; the authorized lifecycle
creates its executable project and lock in a disposable external projection,
freezes the acquired Hex graph, and retains compiled application and dependency
artifacts. Generated source never supplies `mix.exs` or `mix.lock` authority.
