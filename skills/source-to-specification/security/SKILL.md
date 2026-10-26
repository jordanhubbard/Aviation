---
name: "security"
description: "Security boundaries. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "literate-ai/spec-authoring-skill@1"
skill_id: "security"
version: "1.0.0"
title: "Security boundaries"
capabilities:
  - "source-to-specification.security"
facets:
  - "security"
  - "trust"
  - "permissions"
  - "data-flow"
evidence_kinds:
  - "call-paths"
  - "data-flow"
  - "dangerous-operations"
  - "configuration"
model_capabilities:
  - "reasoning"
  - "structured-output"
  - "long-context"
dependencies:
  - "architecture"
  - "api-surface"
after:
  - "tests"
limitations:
  - "Source observations are not a vulnerability scan or safety classification."
trust_classification: "builtin-reviewed"
---
# Security boundaries

Describe trust boundaries, permissions, sensitive data flow, and dangerous operations without claiming unverified safety.
