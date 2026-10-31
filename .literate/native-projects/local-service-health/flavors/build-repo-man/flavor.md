---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "build-repo-man"
version: "1.0.0"
display_name: "repo.sh / packman build system"
primary_axis: "build.system"
target: "repo-man"
secondary_constraints: []
applicable_capabilities: []
provides:
  - name: "build.policy.repo-man"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/repo-man-build-system/SKILL.md"
contributions:
  - contribution_id: "repo-man-standard-command-profile"
    kind: "builder"
    merge_operator: "exact-singleton"
    slot: "standard-build-system-command"
    content:
      kind: "standard-command-profile"
      uri: "standard-command-profile.json"
conflicts: []
co_requisites: []
order_before: []
order_after: []
---
# repo.sh / packman build system

Select this Flavor when the `build.system` axis should resolve to NVIDIA repo_man
with packman. Host preflight must detect a `repo.sh` or `repo.bat` driver at the
project root or a nested project directory, then record the platform `build.sh` or
`build.bat` wrapper as authoritative when present and runnable. Use this Flavor when
the legacy pipeline is driven by repo_man, not GNU Make, CMake, or Bazel as the
operator-facing build system.

Convert wraps each detected repo_man root's exact recorded build entrypoint as a
named harness stage. Do not invent packman or premake invocations that were not
recorded in `.literate/harness-inventory.json`.
