---
name: "operations"
description: "Operations and recovery. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "literate-ai/spec-authoring-skill@1"
skill_id: "operations"
version: "1.0.0"
title: "Operations and recovery"
capabilities:
  - "source-to-specification.operations"
facets:
  - "configuration"
  - "persistence"
  - "recovery"
  - "telemetry"
  - "deployment"
evidence_kinds:
  - "configuration"
  - "entrypoints"
  - "error-paths"
  - "tests"
  - "documentation"
model_capabilities:
  - "reasoning"
  - "structured-output"
  - "long-context"
dependencies:
  - "architecture"
  - "behavior-state"
after:
  - "security"
limitations:
  - "Deployment files may describe environments not exercised by tests."
trust_classification: "builtin-reviewed"
---
# Operations and recovery

Describe configuration, persistence, failure recovery, telemetry, and deployment behavior with explicit evidence gaps.
