---
name: "tests"
description: "Test-backed behavior. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "literate-ai/spec-authoring-skill@1"
skill_id: "tests"
version: "1.0.0"
title: "Test-backed behavior"
capabilities:
  - "source-to-specification.tests"
facets:
  - "tests"
  - "negative-paths"
  - "compatibility"
evidence_kinds:
  - "tests"
  - "fixtures"
  - "assertions"
  - "coverage"
model_capabilities:
  - "reasoning"
  - "structured-output"
dependencies:
  - "behavior-state"
after:
  - "behavior-state"
limitations:
  - "Passing tests can preserve defects and do not establish complete coverage."
trust_classification: "builtin-reviewed"
---
# Test-backed behavior

Extract asserted positive and negative behavior. Mark likely defect preservation and missing coverage explicitly.
