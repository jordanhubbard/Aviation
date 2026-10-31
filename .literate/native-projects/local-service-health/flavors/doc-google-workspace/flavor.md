---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "doc-google-workspace"
version: "1.0.0"
display_name: "Google Workspace documentation"
primary_axis: "documentation.ecosystem"
target: "google-workspace"
secondary_constraints: []
applicable_capabilities:
  - "literate-ai.document-pair"
provides:
  - name: "documentation.ecosystem.google-workspace"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
  - "document-pair.md"
authoring_inputs: []
contributions:
  - contribution_id: "google-workspace-document-pair-binding"
    kind: "specification"
    merge_operator: "exact-singleton"
    slot: "document-pair-ecosystem"
    content:
      kind: "specification"
      uri: "document-pair.md"
conflicts:
  - "flavor://literate-ai/doc-microsoft-365"
co_requisites: []
order_before: []
order_after: []
---
# Google Workspace documentation

Select this Flavor when maintained presentations and documents should use Google Slides
and Google Docs as their native collaboration surfaces.
