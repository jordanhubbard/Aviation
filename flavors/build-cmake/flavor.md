---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "build-cmake"
version: "1.0.0"
display_name: "CMake build system"
primary_axis: "build.system"
target: "cmake"
secondary_constraints: []
applicable_capabilities: []
provides:
  - name: "build.policy.cmake"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/cmake-build-system/SKILL.md"
contributions:
  - contribution_id: "cmake-standard-command-profile"
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
# CMake build system

Select this Flavor when the `build.system` axis should resolve to CMake. Host preflight must detect a compatible `cmake` command and provision it when the selected host does not already provide one. Use CMake when the ecosystem's native toolchain expects a portable, out-of-source, cross-platform build description with `find_package`/`target_link_libraries` idioms rather than Bazel's hermetic sandbox or Make's hand-written recipes.

The Standard lifecycle locks the Flavor's native CMake command profile, discovers the
first compatible `cmake` command from ordered `PATH` authority, configures an
out-of-source build under the framework-owned object root, and builds the exact
generated `source/CMakeLists.txt` target with framework-owned object, artifact, export,
and language tool paths. CMake remains independent of the Bazel-specific target-label
contract and the Make-specific Makefile-variable contract.
