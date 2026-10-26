---
name: "api-surface"
description: "Public API surface. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "literate-ai/spec-authoring-skill@1"
skill_id: "api-surface"
version: "1.0.0"
title: "Public API surface"
capabilities:
  - "source-to-specification.api-surface"
facets:
  - "public-api"
  - "data-contracts"
  - "errors"
evidence_kinds:
  - "symbols"
  - "signatures"
  - "types"
  - "tests"
model_capabilities:
  - "reasoning"
  - "structured-output"
  - "long-context"
dependencies:
  - "architecture"
after:
  - "architecture"
limitations:
  - "Visibility conventions require language-specific evidence."
trust_classification: "builtin-reviewed"
---
# Public API surface

Identify externally observable symbols, inputs, outputs, errors, and compatibility behavior without promoting internal helpers.
