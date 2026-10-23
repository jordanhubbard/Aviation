---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "os-macos"
version: "1.0.0"
display_name: "Portable macOS Host"
primary_axis: "platform.os"
target: "macos"
secondary_constraints: []
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "platform.os.macos"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs: []
contributions:
  - contribution_id: "macos-standard-command-profile"
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
# Portable macOS Host

Select this Flavor when the `platform.os` axis should resolve to `macos`. The referenced
specification contains the exact generation policy contributed by this choice.
Remote-worker host configuration also attempts NTP synchronization to `time.nist.gov`;
failure is logged in bootstrap evidence and does not fail sample-worker readiness.
