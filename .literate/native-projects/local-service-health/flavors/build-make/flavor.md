---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "build-make"
version: "1.2.1"
display_name: "GNU Make build system"
primary_axis: "build.system"
target: "make"
secondary_constraints: []
applicable_capabilities: []
provides:
  - name: "build.policy.make"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/make-build-system/SKILL.md"
contributions:
  - contribution_id: "make-standard-command-profile"
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
# GNU Make build system

Select this Flavor when the `build.system` axis should resolve to GNU Make. Host preflight must detect a compatible `make` command and provision it when the selected host does not already provide one. Use Make when Bazel's sandbox, Bzlmod resolver, and hermetic multi-language cross-compilation are unnecessary overhead.

The Standard lifecycle locks the Flavor's native Make command profile, discovers the
first compatible GNU Make command from ordered `PATH` authority, and invokes the exact
generated `source/Makefile` with framework-owned object, artifact, export, and language
tool paths. Make remains independent of the Bazel-specific target-label contract.
