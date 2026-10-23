# ADR 0002: Rewrite Retained Implementation as Native
# Literate AI Authority

- Status: Proposed
- Date: 2026-10-23
- Decision owners: project maintainers
- Phase 1.2 evidence: `sha256:c5ca4361ba010f6e8d81c93398468f9f4f8b8cc352504bc8535fa74b7c6e9990`

## Context

The original project now lives at `components/legacy-project-wrapper/implementation` and passes the same
build, test, package, and CI workflow through first-class Literate AI shims. That move
proved project reorganization only. The retained implementation remains release

## Decision

Run a second, independently reviewed migration program that replaces retained
implementation surfaces with native Literate AI Components, Flavors, skills, and
assets. Work proceeds one public boundary at a time:

1. Inventory the boundary from retained source, tests, docs, build metadata, and the
   Phase 1 evidence without treating implementation detail as product intent.
2. Author or refine a native Component specification and its named interface/data
   contracts. Target-specific behavior belongs in Flavors; conversion practice belongs
   in exact skills; immutable non-code inputs become assets.
3. Generate a candidate in the normal Literate AI lifecycle and compare its build,
   tests, package outputs, and observable behavior with the retained baseline.
4. Transfer release authority only after independent acceptance and regenerative
   qualification. Until then the retained source remains authoritative.
5. Remove the replaced retained files with `git rm` when tracked or `rm` otherwise,
   rerun the complete workflow, and record parity before beginning the next boundary.

## Guardrails

- This ADR does not claim source disposability before regenerative qualification.
- Generated source stays in the accepted source cache; objects and fetched binaries
  stay under the object root and never enter Git.
- No target-specific Dockerfile, package-manager, OS, or toolchain instruction is
  copied into Component prose; those remain Flavor authority.
- A failed replacement restores the retained files and keeps their authority state.
- Publication and deletion remain separately authorized operations.

## Completion

The rewrite is complete only when every retained boundary has either transferred to a
qualified native Component or is documented as intentionally retained, the full E2E
workflow matches the Phase 1.2 baseline, and `components/legacy-project-wrapper/implementation` contains no
unclassified remainder.
