---
name: develop-in-dev-workflow
description: "The fastest, innermost agent development posture -- verify locally, iterate freely, and treat the remote CI matrix as an async confirmation rather than a per-step gate. Nested inside staging and production: this skill only defers when full verification happens, never skips what those outer postures ultimately require."
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Develop in dev workflow

Inherits `../SKILL.md` (staging), `../../SKILL.md` (production), and
`../../../SKILL.md` (agent catalog). Innermost loop. Matching generation
workflow: `workflows/production/staging/dev/workflow.md`.

## Delta from staging

0. At the beginning of this cycle, follow `survey-peer-work/SKILL.md`
   (`--when start`). Prefer an already-green PR over starting a duplicate
   branch.
1. Verify locally (unit tests, lint/format, the project's fast gate) before
   considering a piece done. That is the input staging expects.
2. Keep iterating locally while you are the only one touching this work. Do not
   push to a shared branch just to get a CI opinion on something still in flux.
3. When the piece is ready to join others, hand it to staging's consolidation
   step. A batch of one still consolidates, re-verifies locally against the push
   target, then pushes.
4. Never treat a local pass as enough for published or tagged state — that is
   production, regardless of how small the change looks.
5. Before landing, follow `survey-peer-work/SKILL.md` (`--when end`) so leftover
   worktrees and branches are collected into this PR, then follow
   `land/SKILL.md`. Keep `## Unreleased` current as the queue item closes;
   `release prepare` only promotes that section.

This project's `agent_development_workflow` defaults to `"dev"` when the field is
absent. Escalate to staging or production when their "when you are here" rules
apply.
