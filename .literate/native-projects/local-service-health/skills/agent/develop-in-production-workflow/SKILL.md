---
name: develop-in-production-workflow
description: "The strictest, outermost agent development posture -- every change individually verified against the full remote CI matrix before it lands, formal evidence retained, nothing batched or force-pushed. Use when working directly against a tagged release, a hotfix to already-published state, or any change whose blast radius the agent cannot fully verify locally. Nested staging and dev skills under this directory narrow when verification happens; they never skip what this skill requires."
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Develop in production workflow

Inherits `../SKILL.md`. This directory is the outer development posture. Nested
`staging/` and `staging/dev/` are deltas, not independent copies.
`workflows/production/workflow.md` is the matching generation workflow.

Run `litai project guidance --operation develop` before changing the tree. Obey
its requirements and exact argv; report every named failure or skip rather than
substituting ambient Git or forge commands.

## Formal evidence

- Follow `skills/agent/release-project/SKILL.md` when the work is a release.
  `litai release` owns the mechanics; this skill owns the production posture.
- Retain verification evidence in `docs/roadmap/active-work.md` and the changelog,
  not only in conversation. Never generate product claims from commit messages.

Escalate routine work when it targets published state or has a blast radius that
cannot be verified locally. Preserve evidence and never rewrite published history.
