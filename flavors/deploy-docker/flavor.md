---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "deploy-docker"
version: "1.0.0"
display_name: "Docker container image deployment"
primary_axis: "deployment"
target: "docker"
secondary_constraints: []
applicable_capabilities:
  - "application.portable-json"
  - "sample.portable-app"
provides:
  - name: "deploy.container-image"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/docker-container-application/SKILL.md"
contributions:
  - contribution_id: "docker-container-provider"
    kind: "runtime"
    merge_operator: "keyed-union"
    slot: "container-image-provider"
    content:
      kind: "deployment-policy"
      uri: "openspec/spec.md"
conflicts: []
co_requisites:
  - "flavor://literate-ai/container-python"
order_before: []
order_after: []
---
# Docker container image deployment

Select this Flavor when the application deploys as a Docker container image. The
selected packaging Flavors and the Component's declared entrypoints are the exact
inputs a generated `Dockerfile` consumes; parent containers join through the Flavor
graph, never through ad hoc base-image prose.
