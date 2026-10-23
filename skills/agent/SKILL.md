---
name: agent
description: >
  Shared rules for Literate AI agent skills nested under skills/agent. Use when
  authoring or following any agent skill: wrap deterministic Python or litai
  commands, keep SKILL.md as routing and judgment, and treat nested skills as
  deltas of their parent directory.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Agent skills

Skills under `skills/agent/` inherit this file by directory nesting. Read every
ancestor `SKILL.md` from this catalog root down to the nested skill that matches
the task. Nested Components, Flavors, and workflows use the same scoping: a
deeper directory is a narrower item, not a copy of its parent.

The project root `SKILL.md` points here so onboarding stays short. There is no
persistent Literate AI process: an interactive coding session follows the nested
skill that matches the task (operator MCP catalog, release, Jira association,
channel ingest, workers, and so on).

## Wrap Python so skills do not spend tokens

When a deterministic command exists (`litai …`, `python -m literate_ai…`, or a
skill-local `scripts/*.py`), the skill names that command and the evidence it
emits. It does not restate the command's algorithm, error catalog, or identity
rules. Those belong in Python so they do not bloat an agent's context window.

The host preflight commands are the reference shape: short routing plus a command that
emits versioned JSON. `release-project` wraps `litai release`; nested deltas
wrap backport, evidence, advance, CI status, published verify, and descendant
notify. `package-artifacts` wraps `litai package`. `ci-test-plan` wraps
`litai project ci-plan`. `survey-peer-work` wraps `litai project peer-work`.
`align-workers` wraps `litai worker align`.
Mutagenic Jira/Slack/Outlook notify is `litai` itself when the operator
catalog lists those servers; nested skills wrap that CLI and must not
re-post the same envelopes.

Generation skills under `skills/specification-to-source/` are the exception —
they are the prompt — and must stay compact for that reason.

## Nested skills are deltas

A nested skill states only what it adds or narrows relative to its parent
directory's `SKILL.md`. It does not copy parent rules. An agent following a
nested skill reads the ancestor chain.

## Size

Keep each `SKILL.md` short enough to route: which command to run, the judgment
Python cannot encode, and fail-closed boundaries. Extra detail belongs in Python,
a linked reference file, or architecture documentation the root onboarding skill
already points at.
