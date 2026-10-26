---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "os-freebsd"
version: "1.0.0"
display_name: "Portable FreeBSD Host"
primary_axis: "platform.os"
target: "freebsd"
secondary_constraints: []
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "platform.os.freebsd"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs: []
contributions:
  - contribution_id: "freebsd-standard-command-profile"
    kind: "builder"
    merge_operator: "exact-singleton"
    slot: "standard-platform-command"
    content:
      kind: "standard-command-profile"
      uri: "standard-command-profile.json"
conflicts: []
co_requisites: []
order_before: []
order_after: []
---
# Portable FreeBSD Host

Select this Flavor when the `platform.os` axis should resolve to `freebsd`. The referenced
specification contains the exact generation policy contributed by this choice.
FreeBSD workers may be physical machines or virtual guests. Native userland and
kernel identity must be observed independently of the virtualization host.
