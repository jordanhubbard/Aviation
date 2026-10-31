---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "container-python"
version: "1.0.0"
display_name: "Digest-pinned Python 3.11 container base"
primary_axis: "deployment"
target: "python-container-base"
secondary_constraints: []
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "deploy.container-base"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs: []
contributions:
  - contribution_id: "python-container-base"
    kind: "runtime"
    merge_operator: "keyed-union"
    slot: "container-base"
    content:
      kind: "container-base"
      uri: "container-base.json"
conflicts: []
co_requisites: []
order_before:
  - "flavor://literate-ai/deploy-docker"
order_after: []
---
# Digest-pinned Python container base

Select this Flavor with the Docker deployment Flavor when a generated Python 3.11
application requires a container runtime. The referenced OCI index digest is the sole
base-image authority; its tag hint is informational and may move independently.
