---
name: record-user-directed-work
description: Turn substantive user suggestions, corrections, architectural direction, and requested changes into durable reasoned repository work items before implementation, keep their evidence checklists current while working, and record completed outcomes in the appropriate project changelog. Reconcile open GitHub or GitLab issues and pull/merge requests into the same queue during planning passes, and comment back on a cited issue when its work item reaches a terminal state. Use whenever an agent changes a Literate AI project in response to user direction, discovers follow-up work while executing it, or plans a release.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Record user-directed work

Convert conversation into durable project state before changing implementation authority.
Do not treat a plausible interpretation as permission to improvise silently.

## Record before implementation

1. Read `docs/roadmap/active-work.md`. Create it from the initialized template if it is
   absent.
2. Before planning a release, starting a roadmap-maintenance pass, or whenever
   explicitly asked to review outstanding requests, reconcile with the project's
   issue tracker. Run `litai project tracker inspect` in the project root. It reads
   Git remotes (the same authority as `.git/config`, including worktrees) and names
   the forge and CLI: GitHub uses `gh`; GitLab uses `glab`. Then list open items
   with the `issue_list` and `review_list` argv from that inspect result. File any
   open issue that lacks a corresponding queue item using the same allocation rule
   as step 4 below, citing it with `**GitHub issue:** [#NN](...)` or
   `**GitLab issue:** [#NN](...)` so the connection survives independent of this
   conversation. An open pull request or merge request without a queue entry belongs
   in the roadmap's "Open pull-request landing queue" the same way. Do not run this
   reconciliation on every unrelated edit; it is a planning-pass step, not a
   per-commit one. The per-cycle survey of green PRs and leftover worktrees is
   `skills/agent/develop-in-production-workflow/staging/dev/survey-peer-work/SKILL.md`,
   not this planning pass. If inspect reports `unsupported` or fails closed, skip tracker
   reconciliation and say so. Use those same CLIs to comment, edit, or open issues
   and review requests; do not invent a third tracker client.
3. Separate the user's desired outcome from a proposed implementation. Inspect current
   authority and evidence, then state the conclusion that determines the next action.
4. Assign the narrowest owner: Component, Flavor, skill, workflow, routing policy,
   documentation, or framework core. Prefer an existing work item when the direction
   refines it; otherwise allocate the next stable `AREA-NNN` ID.
5. For a new item, run `litai work record` with the fields below. Python owns stable
   ID validation, duplicate rejection, checklist shape, and atomic Markdown update.
   Use ordinary editing only when updating the reasoned prose of an existing item:
   - priority and owning authority;
   - a concise paraphrase of the direction;
   - the reasoned conclusion and scope boundary;
   - dependencies in execution order;
   - concrete implementation subtasks; and
   - evidence that must pass before completion.
6. Link a detailed roadmap document instead of copying it when one already owns the
   design. The active file must still name the next unchecked action so a new agent can
   resume without conversation history.

Create a new detailed file beneath `docs/roadmap/` only when the program's rationale,
ordering, and acceptance contract cannot remain readable in one queue item. Immediately
after its title, give it this visible lifecycle header:

```markdown
- **Status:** active
- **Owning queue item:** [AREA-NNN](active-work.md#area-nnn-heading)
- **Completion / archival evidence:** pending while AREA-NNN remains open
```

Use only `active`, `partial`, `deferred`, `completed`, or `historical`. The owner must
link to an existing checkbox or named program heading in `active-work.md`; do not invent
a detached plan. `partial` means landed evidence and unfinished acceptance, while
`deferred` must name the prerequisite that makes it ineligible. A `completed` plan must
link its terminal evidence. Move substantial closed programs to
`docs/history/roadmap/`, retain their original owner link, mark them `historical`, and
link archival evidence. Do not use the roadmap directory as an undifferentiated archive.

Diagnostic inspection may precede recording when it is necessary to understand the
request. Do not edit source, specifications, Flavors, skills, or project configuration
first. If emergency containment requires an immediate reversible change, record the
item in the same turn and label why ordering was exceptional.

## Execute from the recorded queue

- Respect declared dependencies and keep at most one next action per work item marked
  `in progress` in prose. Markdown checkboxes remain the portable status authority.
- Add newly discovered defects or follow-ups as explicit subtasks; never rely on chat
  memory or hide them in a final response.
- Preserve user language as intent, not as an unreviewed technical design. Record why
  the selected solution follows from repository evidence and name rejected scope when
  it matters.
- Classify ownership across repository lineage before editing. If a change applies
  strictly to a parent Component or repository, put it in that parent. Before changing
  parent-owned authority, run `litai project tracker inspect` in the parent checkout,
  execute its `issue_search` command with a concise portable query, and link an existing
  issue when one matches. If none matches, prepare a provider-neutral issue containing
  only the anonymized defect or proposal class, portable contract, and upstream fixture;
  exclude secret-shaped values, downstream hostnames, credentials, mission vocabulary,
  and ephemeral paths. With explicit external-write authorization, execute the returned
  `issue_create` argv (`gh issue create` or `glab issue create`) before source changes.
  Record reciprocal links in the upstream issue and any downstream recovery item. The
  issue creates triage authority, not permission to branch, merge, close, release, or
  mutate other external state. If search, authentication, or the forge is unavailable,
  retain the sanitized issue draft in the downstream roadmap and mark upstream filing
  as the next blocked action; do not silently skip it. Check the parent out in this
  project with `litai project parent checkout URL[#REVISION]`;
  it places the working tree at `parents/<id>/`, initializes submodules, and pulls
  Git LFS when pointers are present. Do not clone parents into `/tmp` or extra
  worktrees. With authenticated Git write access, contribute through a reviewable
  branch plus a pull request (`gh pr`) or merge request (`glab mr`) from that
  checkout; never silently mutate the parent's default branch. Without access, keep
  the proposed patch or local override and its work item in the child repository.
- When a child exposes a parent defect, keep only the anonymized defect class,
  provider-neutral contract, and parent fixture upstream. Keep the child's recovery,
  mission vocabulary, paths, and release evidence downstream. Reciprocal references may
  preserve traceability, but neither repository's gate may depend directly on the other.
- Keep secrets, hostnames, credentials, raw prompt journals, and ephemeral paths out of
  the roadmap. Link content identities or durable evidence locations when available.
- Do not check an implementation or evidence box merely because code was written.

## Close with evidence and changelog

1. Run every evidence item at the scope claimed by the work item.
2. Check each evidence box only after recording a concise durable result, such as a test
   target, platform, artifact identity, or commit.
3. Run `litai work close ID` to check the parent item only when all required subtasks
   and evidence are complete. Leave
   partial work unchecked across commits and sessions.
   Update any linked detailed roadmap to `partial`, `completed`, or `historical` from
   the same evidence; never infer a terminal state from prose or a subset of checks.
4. Add one user-facing outcome to the changelog selected by ownership:
   - use an existing Component-local changelog when the project declares one;
   - otherwise use the project root `CHANGELOG.md` and prefix the Component/Flavor/skill
     scope when useful;
   - use the framework root changelog for core semantics and initialized templates.
   Keep `## Unreleased` current as items close; `litai release prepare` only
   promotes that section and must not be the first time a human sees the claims.
5. Keep planning rationale in the roadmap and release-visible outcomes in the changelog;
   do not duplicate full task descriptions.
6. Commit the work item, implementation, evidence updates, and changelog together when
   practical. Git is the history; do not maintain a second timestamped task ledger.
7. When a work item carries a `**GitHub issue:**` or `**GitLab issue:**` citation and
   reaches a terminal or attention-needing state — completed, rejected as out of
   scope, or blocked on clarification from the filer — comment on that issue with the
   matching CLI (`gh issue comment` or `glab issue comment`) and a permalink back to
   the roadmap item (a commit-pinned `blob/<sha>/docs/roadmap/active-work.md#L<start>-
   <end>` line range, not a heading anchor, so it stays accurate as the file grows) and
   the outcome in one or two sentences. Close the issue only when explicitly authorized
   to; otherwise leave that to the filer or a maintainer.

## Preserve the learning loop

When execution reveals a reusable lesson, update the narrowest owning specification,
Flavor, or skill and add that authority change to the same work item. One-off candidate
mistakes belong in run evidence. A repeated framework-process defect belongs in this
skill or the framework workflow, with its own evidence gate.
