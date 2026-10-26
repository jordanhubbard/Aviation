---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "doc-microsoft-365"
version: "1.0.0"
display_name: "Microsoft 365 documentation"
primary_axis: "documentation.ecosystem"
target: "microsoft-365"
secondary_constraints: []
applicable_capabilities:
  - "literate-ai.document-pair"
provides:
  - name: "documentation.ecosystem.microsoft-365"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
  - "document-pair.md"
authoring_inputs: []
contributions:
  - contribution_id: "microsoft-365-document-pair-binding"
    kind: "specification"
    merge_operator: "exact-singleton"
    slot: "document-pair-ecosystem"
    content:
      kind: "specification"
      uri: "document-pair.md"
conflicts:
  - "flavor://literate-ai/doc-google-workspace"
co_requisites: []
order_before: []
order_after: []
---
# Microsoft 365 documentation

Select this Flavor when maintained presentations and documents should use PowerPoint and
Word as their native formats, with SharePoint or OneDrive as the collaboration surface.
