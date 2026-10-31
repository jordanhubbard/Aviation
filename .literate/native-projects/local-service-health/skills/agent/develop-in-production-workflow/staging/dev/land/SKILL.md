---
name: land-on-trunk
description: Land a verified change on the default branch through the forge PR or MR named by tracker inspect. Use when a queue item is ready to join the trunk before a release backport.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Land on the trunk

Inherits `../SKILL.md` (dev), staging, production, and the agent catalog. Run
`litai project guidance --operation land`; obey its requirements and exact argv.
Named skips are outcomes to report, not permission to invent forge commands.

## What to run

Use a truthful title and body grounded in the queue item. Resolve peer-work and
merge conflicts deliberately, wait for required CI, and never force-push or
rewrite published history. If a release line needs the landed fix, follow
`skills/agent/release-project/backport/SKILL.md`.
