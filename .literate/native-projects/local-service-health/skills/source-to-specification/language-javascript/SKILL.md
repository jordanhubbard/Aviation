---
name: "language-javascript"
description: "JavaScript source semantics. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "literate-ai/spec-authoring-skill@1"
skill_id: "language-javascript"
version: "1.0.1"
title: "JavaScript source semantics"
capabilities:
  - "source-to-specification.language.javascript"
facets:
  - "language-binding"
  - "runtime-semantics"
evidence_kinds:
  - "modules"
  - "exports"
  - "promises"
  - "errors"
  - "package-metadata"
  - "tests"
model_capabilities:
  - "reasoning"
  - "structured-output"
  - "long-context"
dependencies:
  - "architecture"
  - "api-surface"
  - "behavior-state"
  - "tests"
after:
  - "operations"
limitations:
  - "Static JavaScript analysis cannot establish runtime mutation, dynamic module loading, host APIs, or dependency lifecycle behavior."
trust_classification: "builtin-reviewed"
extensions:
  language: "javascript"
  workflow: "source-to-specification"
---
# JavaScript source semantics

Translate JavaScript or TypeScript module exports, data shapes, promises, errors, host-runtime assumptions, and package entrypoints into evidence-backed base or Flavor proposals. Keep runtime-specific behavior in a selected Flavor.

Preserve every observable ordering and tie-break as a separate normative rule. Name the
exact JavaScript comparator: default `Array.prototype.sort` compares string-converted
values by UTF-16 code units, a supplied compare function defines its own domain and
direction, and `localeCompare` introduces locale and option dependencies that must not
be guessed. Do not reduce any of these to generic "lexicographic" ordering. Distinguish
returned sequence order from selection tie-breaks, and cite the exact expression plus
any test evidence for each claim. Keep operand coercion, locale, stability, or host
behavior blocking when the supplied evidence does not establish it.
