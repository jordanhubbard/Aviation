---
name: develop-in-staging-workflow
description: "The middle agent development posture -- a small batch of related, already-locally-verified changes lands together, gated by one full remote CI pass before merge. Nested inside develop-in-production-workflow: inherits that baseline and only narrows when full verification happens. Use when landing several related pull requests together or integrating parallel forks before a shared branch."
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Develop in staging workflow

Inherits `../SKILL.md` (production) and `../../SKILL.md` (agent catalog). This
directory is nested inside production: the same fail-closed rules, except the
remote matrix runs once per *batch* rather than once per *change*.
`workflows/production/staging/workflow.md` is the matching generation workflow.

## Delta from production

1. Each piece of the batch verifies locally first (`staging/dev/`).
2. Consolidate, run the complete local suite once, then push. Nothing in the
   batch is landed until the batch is.
3. Require the full remote CI matrix on the consolidated push before merging to
   the default branch. Do not merge on local-only confidence.
4. If remote CI fails, fix forward against the same consolidated commit. Do not
   silently drop a failing piece.

Production's per-change gate still applies to anything already published. Work
still being iterated stays in `staging/dev/`.
