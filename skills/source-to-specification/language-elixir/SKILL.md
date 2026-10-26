---
name: "language-elixir"
description: "Recover evidence-backed Elixir and Erlang/OTP behavior when translating Elixir source into Literate AI specifications. Use for inverse translation of .ex modules and .exs scripts."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "literate-ai/spec-authoring-skill@1"
skill_id: "language-elixir"
version: "1.0.0"
title: "Elixir source semantics"
capabilities:
  - "source-to-specification.language.elixir"
facets:
  - "language-binding"
  - "runtime-semantics"
evidence_kinds:
  - "modules"
  - "functions"
  - "patterns"
  - "errors"
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
  - "Static source cannot establish runtime process schedules, macro expansions, dynamic module loading, or native extension effects. Retain unobserved behavior as uncertainty."
  - "Never evaluate source, expand macros, install dependencies, or execute request data to obtain translation evidence."
trust_classification: "builtin-reviewed"
extensions:
  language: "elixir"
  workflow: "source-to-specification"
---
# Elixir source semantics

Translate admitted `.ex` and `.exs` evidence into base behavior and Elixir Flavor
proposals. Cite exact modules, function clauses, guards, pattern matches, pipelines,
error handling, and native tests for each claim. Keep framework dispatch and test
reporting distinct from product behavior. Preserve exact integer arithmetic, division
and rounding, JSON input shapes, output channels, and failure-before-output ordering.

Recover helper paths relative to `__DIR__` and distinguish portable script trees
from evidenced Mix/Hex dependencies or OTP releases. Do not infer Phoenix, a
supervision tree, or a dependency-free build solely from the implementation language.

Record each ordering and tie-break separately, naming the `Enum.sort`, `sort_by`,
comparator, key, reversal, and normalization expressions. Distinguish binary ordering
from charlist or general Erlang term ordering, and explicit selection rules from map
iteration. Preserve uncertainty when operand types or custom comparators are unknown.
Trace `String.trim`, case conversion, and regular-expression rewrites separately.

For process behavior, cite message handling, links, monitors, supervision, and state
transitions without inventing scheduling guarantees. Treat `raise`, `throw`, `exit`,
rescues, catches, and tuple error returns as separate observed failure contracts.
Emit evidence-backed observations through the inverse workflow's structured schema;
retain unresolved semantics instead of weakening coverage or qualification gates.
