---
name: "language-cpp"
description: "C++ source semantics. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "literate-ai/spec-authoring-skill@1"
skill_id: "language-cpp"
version: "1.0.1"
title: "C++ source semantics"
capabilities:
  - "source-to-specification.language.cpp"
facets:
  - "language-binding"
  - "runtime-semantics"
evidence_kinds:
  - "translation-units"
  - "headers"
  - "symbols"
  - "templates"
  - "lifetimes"
  - "build-graph"
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
  - "Static C++ analysis cannot prove undefined-behavior freedom, lifetime safety, ABI compatibility, or configuration-dependent preprocessing."
trust_classification: "builtin-reviewed"
extensions:
  language: "cpp"
  workflow: "source-to-specification"
---
# C++ source semantics

Translate C++ headers and translation units into evidence-backed API, ownership, error,
ABI, and build requirements. Separate portable behavior from compiler, standard-library,
and platform Flavor proposals.

Preserve the exact observable comparison semantics of ordered containers, algorithms,
and tie-break branches. Name whether strings are ordered by raw bytes, code units,
Unicode scalar/code-point values, locale collation, case-folded values, or another
evidenced comparator; never reduce these distinctions to the word "lexicographic." For
valid UTF-8, unsigned-byte lexicographic order preserves Unicode code-point order, but
claim that equivalence only when the input path establishes valid UTF-8. Otherwise state
the measured byte ordering and retain encoding validity as a blocking uncertainty.
Describe separately every output sequence ordering and every selection tie-break, citing
the exact container, comparator, branch, and test evidence that supports each rule.
