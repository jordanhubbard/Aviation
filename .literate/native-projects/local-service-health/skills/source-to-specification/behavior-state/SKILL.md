---
name: "behavior-state"
description: "Behavior and state. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "literate-ai/spec-authoring-skill@1"
skill_id: "behavior-state"
version: "1.0.0"
title: "Behavior and state"
capabilities:
  - "source-to-specification.behavior-state"
facets:
  - "behavior"
  - "state"
  - "concurrency"
  - "invariants"
evidence_kinds:
  - "call-paths"
  - "state-writes"
  - "branches"
  - "tests"
model_capabilities:
  - "reasoning"
  - "structured-output"
  - "long-context"
dependencies:
  - "architecture"
after:
  - "api-surface"
limitations:
  - "Static evidence cannot prove every runtime interleaving."
trust_classification: "builtin-reviewed"
---
# Behavior and state

Describe observable workflows, transitions, invariants, and concurrency limits. Separate observed behavior from inferred intent.
