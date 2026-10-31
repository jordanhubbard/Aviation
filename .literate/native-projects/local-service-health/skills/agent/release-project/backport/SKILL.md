---
name: release-project-backport
description: Cherry-pick already-landed trunk commits onto a release line with litai release backport. Use for patch content on release/x.y.x, backport-status, or when plan fails because the line already exists.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Backport onto a release line

Inherits `../SKILL.md`. Run `litai project guidance --operation backport` and
obey its requirements and exact argv. Report named failures/skips; do not invent
Git operations or mix branches in one release sequence.

## What to run

Keep only patch-eligible commits: bounded correctness, safety, or
   reliability. Catalog-wide re-pins, protocol/schema bumps, Flavor directory
   renames, overview regeneration, and ADR 0006 significant features wait for
   the next human-scheduled minor or major.
Record the patch-content decision in the configured queue. Do not
   stall for a human cherry-pick list unless they override.
If cherry-pick conflicts, stop. Divergence is a signal; resolve
   deliberately, then re-run status.

After a clean backport, plan/prepare/check/publish **on that line**.
