# ADR 0001: Retain Legacy Source Authority During Lift-and-Shift

- Status: Accepted for adoption
- Date: 2026-10-23
- Decision owners: project maintainers
- Baseline evidence: `sha256:4c94a17ff65d261ffdb2111d8e29e88e276f1621f840cfad8b00947df139554d`
- Shim parity evidence: `sha256:f62a894f0cc80a98f882240fbc9090f6aa57b97fc40ced28cc931ebdfc990c21`

## Context

Phase 1 proved the original project end-to-end. Phase 1.1 proved that Literate AI can
drive the same build, test, package, and CI stages through first-class wrapper
source-to-specification transfer has occurred.

## Decision

Move the complete original tree, preserving its internal taxonomy, from quarantine to
`components/legacy-project-wrapper/implementation`. The wrapper Component owns this retained implementation
and `litai.harness.mk` invokes it at its new location. Each move uses `git mv` when the
entry is tracked and plain filesystem move otherwise.

The move is admitted only when the post-move wrapper workflow has the same successful
exit and source-authority tree identity as the Phase 1 direct baseline. Only then is
the empty quarantine directory removed. The retained implementation is not generated
source, not a cache, and not a specification; it remains release authority until a
separate Phase 2 ADR qualifies native Components, Flavors, skills, and assets.

## Consequences

- `components/legacy-project-wrapper/implementation/` is intentionally load-bearing
  retained source and may not be cleaned as a build product.
- Build products still belong outside authority and remain fungible.
- Future migration items replace one retained surface at a time, prove parity, then
  remove its pre-adoption implementation with `git rm` or `rm`.
- Phase 2 owns source-to-specification and native rewrite; this ADR makes no semantic
  equivalence claim beyond E2E parity.
