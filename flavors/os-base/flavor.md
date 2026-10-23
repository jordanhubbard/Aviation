---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "os-base"
version: "1.0.0"
display_name: "Universal Literate AI Host Toolchain"
primary_axis: "platform.os"
target: "base"
secondary_constraints: []
applicable_capabilities:
  - "host.toolchain"
provides:
  - name: "platform.os.base"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs: []
contributions:
  - contribution_id: "universal-host-toolchain"
    kind: "extension"
    merge_operator: "exact-singleton"
    slot: "host-toolchain"
    content:
      kind: "cyclonedx-toolchain-sbom"
      uri: "toolchain.cdx.json"
conflicts: []
co_requisites: []
order_before:
  - "flavor://literate-ai/os-linux"
  - "flavor://literate-ai/os-macos"
  - "flavor://literate-ai/os-windows"
order_after: []
---
# Universal Literate AI host toolchain

This operational Flavor is the base of every supported host realization. Its SBOM owns
only capabilities common to every Literate AI host. Concrete OS Flavors own native
package names, package-manager commands, and OS/architecture artifact realizations.

The coding-agent entries are an alternative capability group. An explicit provider
selection requires that exact entry; otherwise one already installed entry satisfies
the group and Codex is the declared installation default. Authentication is never an
install-time capability.
