---
name: prompt-master
description: >
  Translate a user's rough request into one bounded, provider-aware coding-agent task
  when Literate AI is being used directly without an external task envelope. Do not
  use for work an external task system already translated, ordinary conversation, or
  to modify resolved project authority.
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
  upstream: "https://github.com/nidhinjs/prompt-master"
  upstream_commit: "d15eabbe5d2122eedc060bae8a771381e9873d1b"
  upstream_version: "1.7.0"
  license: "MIT"
---

# Prompt Master for direct Literate AI tasks

This is a Literate AI adaptation of `nidhinjs/prompt-master` 1.7.0. The upstream
skill's useful invariant is retained: convert a rough request into a concise task where
every instruction is load-bearing, target-specific, scoped, and testable. Its broad
creative/media profiles and visible copy-paste output format are intentionally omitted:
this adaptation sits inside the direct coding-agent path, not a general prompt-writing
product.

## Routing boundary

Apply this skill only when **all** of these are true:

- the user is interacting directly with Literate AI or one of its supported coding
  agents;
- no external task envelope (`LITAI_EXTERNAL_TASK_ID`, from an agent ledger or task
  system) identifies an already translated task; and
- the rough request must become a coding-agent task or implementation prompt.

When an external task system supplies the task, do not invoke this skill. Such a
system translates between its own task and provider layers; translating again could
alter scope, stop conditions, or correlation semantics. Consume the supplied task
exactly, while keeping task/correlation IDs outside semantic generation and cache
identities. A forge issue is not such an envelope: an issue filed by a user or agent is
a rough request this skill may translate.

## Authority boundary

This skill can sharpen the *task envelope*. It cannot add or rewrite product behavior,
select a Flavor or model, alter an exact skill set, reorder workflow stages, broaden
filesystem/network privileges, authorize build/execution/publication, or replace the
resolved generation prompt assembled from locked authority.

The following remain authoritative, in order:

1. current Component specifications and public interfaces;
2. selected Flavor requirements;
3. exact specification-to-source skills;
4. workflow and routing policy;
5. validation, security, and execution-authorization policy.

If a user's request conflicts with those inputs, surface the conflict. Do not optimize
the conflict away.

## Translate one direct request

Silently extract these dimensions from the user request and current project evidence:

| Dimension | Required content |
| --- | --- |
| Outcome | One precise operation and target state |
| Provider | Exact coding-agent command selected by Literate AI |
| Starting state | Current project, relevant Component, current failing/passing evidence |
| Authority | Exact specs, Flavors, skills, workflow, and route the task must obey |
| Scope | Files/symbols the agent may change and explicit do-not-touch surfaces |
| Constraints | Security, dependency, compatibility, and user constraints |
| Evidence | Commands and assertions that prove completion |
| Stop conditions | Destructive, ambiguous, privilege-bearing, or authority-changing actions requiring review |
| Output | Expected edits plus concise terminal evidence |

Ask no more than three clarifying questions, and only when a required dimension cannot
be recovered from current project authority. Prefer inspecting the repository to asking
the user for facts already present there.

## Provider-aware task form

For agentic coding providers (`codex`, `claude`, `cursor-agent`, `opencode`), emit one
internal task with these sections:

```text
Outcome
Starting state and exact authority
Allowed scope
Forbidden changes
Required work
Verification
Stop and ask before
Completion report
```

Keep constraints and acceptance criteria in the first third. Name exact paths and
symbols when known. Require repository inspection before edits, implementation rather
than a proposal, and fresh verification before completion. Do not request hidden chain
of thought or fixed reasoning budgets. Never embed credentials, environment-variable
values, raw acceptance oracles, or task-ledger metadata in the provider prompt.

Provider adjustments are narrow:

- `claude`: explain why constraints exist, front-load context, and forbid unrequested
  abstractions or features.
- `codex` / OpenAI reasoning agents: use compact instructions, explicit output and
  done conditions; do not add step-by-step reasoning prompts.
- `cursor-agent`: include file/symbol anchors and a strict do-not-touch list.
- `opencode`: include exact repository scope, required tool use, verification commands,
  and stop conditions for destructive operations.

## Token-efficiency and safety audit

Before dispatch, verify:

1. Every sentence changes the provider's action or acceptance decision.
2. No instruction duplicates locked authority already attached to the request; use an
   exact identity/path reference instead of paraphrasing it.
3. The task has one outcome; split unrelated outcomes into separately authorized runs.
4. File scope, forbidden actions, evidence, and stop conditions are explicit.
5. The task does not claim task-ledger approval grants Literate AI execution privilege.
6. The result can be judged from binary evidence without a corrective re-prompt.

## Provenance

Adapted from Prompt Master 1.7.0 by Nidhin Joseph Nelson, upstream commit
`d15eabbe5d2122eedc060bae8a771381e9873d1b`, under the MIT License. The upstream
copyright and license are reproduced in `LICENSE.prompt-master`.
