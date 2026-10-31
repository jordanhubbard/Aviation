---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "build-bazel"
version: "1.0.0"
display_name: "Bazel-preferred build system"
primary_axis: "build.system"
target: "bazel"
secondary_constraints: []
applicable_capabilities: []
provides:
  - name: "build.policy.bazel"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/bazel-build-system/SKILL.md"
contributions:
  - contribution_id: "bazel-standard-command-profile"
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
# Bazel-preferred build system

Select this Flavor when the `build.system` axis should resolve to `bazel`. The referenced specification contains the exact generation policy contributed by this choice.
