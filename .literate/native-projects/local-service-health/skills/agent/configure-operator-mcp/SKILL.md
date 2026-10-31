---
name: configure-operator-mcp
description: Discover MCP servers already connected in this coding session and write the platform-resolved operator-local Literate AI MCP catalog. Use when that catalog is missing or empty, when the user asks which MCPs Literate AI should use, or before Jira, Slack, or Outlook skills need an opt-in list.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Configure the operator MCP catalog

Inherits `../SKILL.md`. This is operator-local opt-in, never project authority.
Run relevant project guidance first and obey named skips. Python owns catalog
location and schema; do not expose the ambient operator path or store secrets.
Use `litai config paths` to obtain the destination instead of constructing an OS path.

## Discover, then write

1. List MCP servers **already connected in this session** (host MCP attachments).
   Those ids are the default catalog. Ask which to opt into.
2. Optionally consult a reachable MCP registry if one is already in session.
   Absence of an organization MCP service or any registry is not a failure and is not required.
3. Ask which discovered ids to opt into, then run
   `litai config mcp write --server ID[:USE]` for each explicit selection. The
   typed writer owns schema validation and atomic private custody. Verify with
   `litai config mcp show`. Do not copy operator configuration into the project.

Optional `litai --discover-mcps` (off by default) probes those `command` hints
for reachability. It does not write tokens or replace this skill's catalog
authoring. Mutagenic Jira/Slack/Outlook posts are `litai`'s job after journal
success; session skills that wrap `litai` must not re-post the same envelopes.

Unavailable or unselected integrations are named skips, not fallback HTTP work.
