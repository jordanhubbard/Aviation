---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "ui-react"
version: "1.0.0"
display_name: "React UI framework on JavaScript"
primary_axis: "implementation.ui-framework"
target: "react"
secondary_constraints:
  - axis: "implementation.language-ecosystem"
    value: "javascript"
    optional: false
applicable_capabilities:
  - "application.web-frontend"
provides:
  - name: "implementation.ui.react"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/frontend-application/react-application/SKILL.md"
contributions: []
conflicts: []
co_requisites: []
order_before: []
order_after: []
---
# React UI framework on JavaScript

Select this Flavor when the `implementation.ui-framework` axis should resolve to
`react`. It is a secondary Flavor constrained to JavaScript; it does not occupy
`implementation.language-ecosystem` and cannot be selected without `lang-javascript`.
The referenced specification contains the exact generation policy contributed by this
choice.
