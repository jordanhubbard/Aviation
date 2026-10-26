---
name: "language-rust"
description: "Rust source semantics. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "literate-ai/spec-authoring-skill@1"
skill_id: "language-rust"
version: "1.0.1"
title: "Rust source semantics"
capabilities:
  - "source-to-specification.language.rust"
facets:
  - "language-binding"
  - "runtime-semantics"
evidence_kinds:
  - "crates"
  - "public-items"
  - "traits"
  - "ownership"
  - "errors"
  - "features"
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
  - "Static Rust analysis does not establish unsafe-block correctness, feature-combination behavior, or effects of procedural macros and build scripts."
trust_classification: "builtin-reviewed"
extensions:
  language: "rust"
  workflow: "source-to-specification"
---
# Rust source semantics

Translate Rust crates, public items, traits, ownership boundaries, Result errors, async behavior, and Cargo features into evidence-backed base or Flavor proposals. Keep unsafe and macro-expanded behavior explicit and uncertain when unobserved.

Preserve every observable ordering and tie-break as a separate normative rule. Name the
exact `Ord` implementation, comparator closure, key extraction, reversal, and stable or
unstable sorting operation evidenced by the source. Rust `str` and `String` natural
ordering is lexicographic by UTF-8 bytes; for valid Rust strings that byte order also
preserves Unicode scalar-value order, but state the evidenced representation rather
than merely saying "lexicographic." Distinguish returned sequence order from `min`,
`max`, heap, map, and explicit tie-break selection rules, citing the exact expression
and any test evidence. Retain custom-trait, unsafe-byte, locale, or normalization
semantics as blocking when the supplied evidence cannot establish them.
