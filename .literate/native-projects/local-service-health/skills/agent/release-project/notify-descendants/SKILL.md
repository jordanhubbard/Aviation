---
name: release-project-notify-descendants
description: After a published cut, draft pin-bump instructions for operator-named descendant projects. Use when children inherit this repository and must run litai update.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Notify descendant projects

Inherits `../SKILL.md`. There is no consumer registry in this repository.

`litai catalog graph` is **this** project's parent provenance DAG, not a
list of downstream pins. Do not treat it as Physics Workbench sample or any other child.

## What to run

1. `litai catalog graph` so the published identity and parent chain are
   visible for the pin you will quote.
2. Ask the operator which descendant repositories to notify. If they name
   none, record a skip. Do not scrape forks or invent URLs.
3. Draft `litai update` (or `reparent`) pin-bump instructions for each
   named child. Do not clone, commit, or push in those repositories
   without explicit authorization.
4. Optional: comment the same draft on the associated Jira issue through
   `associate-release-jira` / `litai` fan-out. Do not re-post envelopes.

Mutagenic command comments are not a consumer contract.
