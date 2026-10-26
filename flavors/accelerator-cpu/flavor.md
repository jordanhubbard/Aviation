---
schema: "literate-ai/flavor-markdown@1"
namespace: "samples"
name: "accelerator-cpu"
version: "1.0.0"
display_name: "Portable host CPU"
primary_axis: "accelerator"
target: "cpu"
secondary_constraints: []
applicable_capabilities:
  - "sample.portable-app"
provides:
  - name: "accelerator.cpu"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs: []
contributions: []
conflicts: []
co_requisites: []
order_before: []
order_after: []
---
# Portable host CPU

Select this Flavor when the `accelerator` axis should resolve to `cpu`. The referenced specification contains the exact generation policy contributed by this choice.
