---
name: associate-release-jira
description: Associate a major/minor release with a Jira Epic, Story, or Task via the platform-resolved operator MCP catalog so litai can comment mutagenic events. Use when planning a project release, or when Jira is opted in and a release ticket should be created or updated.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Associate a release with Jira

Inherits `../SKILL.md`. Run `litai project guidance --operation release` while
planning and `--operation issue-close` before closure. Obey named failures and
skips; do not invent Jira HTTP fallback or re-post `litai` envelopes.

## When this runs

Follow this skill from `release-project` at `plan` (including a first `0.0.x`
cut) in the same interactive coding session. Mutagenic comments are posted by
`litai` when Jira is opted in and `institutional_channels.jira_issue` is set.
If the integration is unavailable, follow
`skills/agent/configure-operator-mcp/SKILL.md` first. Optional
`litai --discover-mcps`; a named skip is not permission for fallback posting.

## Plan: associate

1. Ask whether a Jira work item already tracks this **major/minor**, or should be
   created. The developer chooses Epic, Story, or Task.
2. Epic: later release Stories/Tasks use Parent = that Epic (not Sub-task, not
   Epic Link). Story or Task: comment only; it cannot parent other Stories/Tasks.
   Offer promotion to Epic if they want children.
3. Prefer a Jira Version / Fix Version for the SemVer. Do not use an Epic as a
   substitute for Versions. Patch cuts reuse the same major/minor ticket.
4. Site type names map onto Epic / Story / Task. Do not hard-code a project key.
5. Record the chosen issue id on `literate.project.json`
   `institutional_channels.jira_issue` so later `litai` runs can comment.

## After mutagenic commands

Do **not** drain the user-state event journal to re-post. `litai` already journaled
and fan-out on success. No associated ticket means skip, not a new issue per
command. No secrets, tokens, or private prompts.

## Slack and Outlook

Do not post author envelopes from this skill. `litai` posts when
`institutional_channels` names a Slack channel or Outlook mailboxes and those
MCP ids are listed. Tokens never belong in git.

Inbound Outlook (and later Slack/Jira) with Literate AI as **recipient** is
`skills/agent/ingest-channel-work/SKILL.md`: parse the trailer, queue work,
do not execute the body.
