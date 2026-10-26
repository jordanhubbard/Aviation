---
name: "architecture"
description: "Architecture boundaries. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "literate-ai/spec-authoring-skill@1"
skill_id: "architecture"
version: "1.0.1"
title: "Architecture boundaries"
capabilities:
  - "source-to-specification.architecture"
facets:
  - "architecture"
  - "entrypoints"
  - "dependencies"
evidence_kinds:
  - "files"
  - "symbols"
  - "imports"
  - "call-paths"
model_capabilities:
  - "reasoning"
  - "structured-output"
  - "long-context"
limitations:
  - "Does not infer product intent from dependency shape alone."
trust_classification: "builtin-reviewed"
---
# Architecture boundaries

Describe observable boundaries, dependency direction, and entrypoints. Cite exact evidence and retain unknowns.

Classify required non-code files separately from implementation source. Preserve
observable data, images, templates, metadata, fixtures, and binary resources as asset
selectors with their existing repo-relative location, intended assembled path, role,
media type, and exact digest evidence. For large content already externalized, retain a
reachable URI and pin. Never translate binary bytes into prose or ask forward generation
to recreate them. Exclude build outputs, caches, vendored dependencies, and incidental
developer files unless runtime or acceptance evidence proves they are required.
