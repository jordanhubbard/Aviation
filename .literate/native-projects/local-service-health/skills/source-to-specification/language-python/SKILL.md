---
name: "language-python"
description: "Python source semantics. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "literate-ai/spec-authoring-skill@1"
skill_id: "language-python"
version: "1.0.3"
title: "Python source semantics"
capabilities:
  - "source-to-specification.language.python"
facets:
  - "language-binding"
  - "runtime-semantics"
evidence_kinds:
  - "python-ast"
  - "imports"
  - "decorators"
  - "exceptions"
  - "tests"
model_capabilities:
  - "reasoning"
  - "structured-output"
dependencies:
  - "architecture"
  - "api-surface"
  - "behavior-state"
  - "tests"
after:
  - "operations"
limitations:
  - "Static Python analysis cannot establish effects hidden behind dynamic imports, monkey-patching, or native extensions."
trust_classification: "builtin-reviewed"
extensions:
  language: "python"
  workflow: "source-to-specification"
---
# Python source semantics

Translate Python modules, public call signatures, exceptions, protocols, async behavior, and packaging conventions into evidence-backed base or Flavor proposals. Keep dynamic behavior uncertain unless separately observed.

Preserve every observable ordering and tie-break as a separate normative rule. For
Python `str` values compared or sorted with the default operators, state that ordering
is lexicographic by Unicode code point; do not shorten that to generic
"lexicographic" ordering. Inspect and name any `key`, comparison wrapper, reversal,
normalization, or locale operation that changes the domain or direction. Distinguish
the order of returned sequences from selection rules such as `min` or `max`, and cite
the exact expression plus any test evidence for each claim. If dynamic values prevent
the operand type or comparator from being established, retain the comparison domain as
a blocking uncertainty.

Recover script failure channels using Python runtime semantics as well as explicit
writes. When the admitted source does not replace `sys.excepthook`, redirect
`sys.stderr`, catch and print an exception itself, or invoke an opaque writer, an
uncaught exception is reported through the default exception hook to standard error.
If every explicit standard-output write is sequenced only after the potentially
failing call returns, state that those failures cannot emit a partial product or mix
diagnostic text with product data on standard output. Retain the channel as uncertain
when hooks, streams, native extensions, or dynamic monkey-patching can change it.

Recover missing-required-field behavior from unconditional mapping access, not only
from explicit validation branches or tests. When evidence establishes a built-in
`dict`, `mapping[key]` raises `KeyError` if that key is absent; if the access occurs
before result construction and no handler or default intercepts it, state explicitly
that the missing required field is rejected without returning a product result. Keep
the behavior uncertain for custom mappings or dynamic dispatch, and distinguish direct
subscription from `.get`, `setdefault`, `__missing__`, and caught `KeyError` paths.
