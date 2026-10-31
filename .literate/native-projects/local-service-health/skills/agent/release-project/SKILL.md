---
name: release-project
description: Plan, prepare, verify, and publish an evidence-bound software release with the project's litai release policy. Use when an agent is asked to bump a project version, prepare release notes, run release gates, create or inspect a release tag, publish a release, or recover from a partially completed release.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Release project

Inherits `../SKILL.md`. Treat a release as a state transition over one exact
project revision. Run `litai project guidance --operation release`; obey its
requirements and exact argv, and report every named failure or skip. The Python
CLI owns mechanics; do not re-derive them.

## Wrap `litai release`

Follow nested deltas instead of inventing Git or CI: `backport/`,
`evidence/`, `advance/`, `ci-status/`, `verify-published/`,
`notify-descendants/`. Landing on the trunk is
`develop-in-production-workflow/staging/dev/land/`.

When the release policy declares `qualification`, run `litai worker align --all`
first, then `litai release qualify`. It covers each platform and action on this
host, then on aligned `workers.json` workers, and uses CI only for what those
cannot cover or when CI is mandatory. For complex projects this is the
fastest-turnaround path; do not wait on hosted CI that the record makes optional.

1. Follow `ci-status/SKILL.md`, inspect the projected plan, and follow
   `skills/agent/associate-release-jira/SKILL.md` for this major/minor.
   Begin with `litai release contributions sweep`: inspect every open issue and
   review plus every unmerged branch and attached worktree. For each open tracker
   item, decide `include` or `defer`, then use `litai release contributions
   disposition` with explicit external-write authorization so its milestone and
   machine-readable comment agree. Included items remain release blockers until
   merged, tested, commented, and closed with the authority the project requires.
   Deferred items name their next or maintenance milestone and reason. Repeat the
   sweep after every merge or scope change and immediately before planning; never
   infer an empty queue from an earlier snapshot.
   For the first stable initial, major, or minor cut, the candidate release line must
   contain the current remote default branch at plan, prepare, check, and publish.
   Backport or merge approved release work when that invariant fails. Patch releases
   remain selective and do not inherit unrelated later default-branch work.
   Any checked-in package version exercised by release gates must be a declared version
   mirror so `prepare` can update it inside the planned atomic write; never pre-stage a
   future package version merely to work around prepared-scope enforcement.
2. For a derived `minor` or `major` release class, regenerate and visually inspect
   every policy-declared terminal document pair. Run the publication preflight with
   the explicitly intended account before any mutation. If `gcloud` has no active
   account, stop and tell the operator to run `gcloud auth login ACCOUNT` and
   `gcloud config set account ACCOUNT`; never select an account for them. Publish
   both stable resource IDs, export both back, verify them, and retain the exact
   release-bound receipt before `litai release plan`.
3. Prepare only after the plan is accepted. Review the diff, finish truthful
   human-authored notes, validate, and commit on the selected line. Before
   prepare can complete, follow `skills/agent/package-artifacts/SKILL.md`
   (`litai package`) for every Component tagged with a package Flavor.
4. `litai release check PLAN` from the exact clean prepared commit on the
   named release line. On gate failure follow `evidence/SKILL.md`. A repaired
   checkpoint completion exits 2 after clearing repair state; repeat the same check and
   continue only when a fresh evaluation from gate one exits 0.
5. Run the contribution sweep again, requiring ready state. `litai release publish
   PREPARED --authorize-external-write` only after check
   produces a current prepared-release identity. Then follow
   `skills/agent/associate-release-jira/SKILL.md` in this session to associate
   or record `institutional_channels.jira_issue`. Do not re-post author
   envelopes; `litai` already fan-out on mutagenic success.
6. Follow `verify-published/SKILL.md` with that same prepared record, then run one
   final contribution sweep so work arriving during publication starts the next
   disposition loop instead of disappearing from release evidence.
7. Follow `advance/SKILL.md` when the default branch still reports a shipped
   version. Then follow `notify-descendants/SKILL.md` for operator-named
   children.

## Judgment the CLI does not encode

- Humans decide *when* the next minor or major ships. Agents decide *what*
  goes in a patch on the current `release/<major>.<minor>.x` line. Record that
  patch-content decision in the queue and execute it; do not wait for the human
  to pick cherry-picks unless they override.
- A patch is already-landed (or landing now on the default branch)
  correctness, safety, or reliability work with a bounded blast radius. It is
  not a catalog-wide identity re-pin, protocol/schema version bump, Flavor
  directory rename, overview regeneration, or a significant feature (ADR 0006).
  Those wait for the next human-scheduled minor or major.
- A significant feature discovered mid-release does not go straight to
  implementation. Draft a project ADR, obtain explicit human acceptance, then follow
  `skills/agent/record-user-directed-work/SKILL.md`. Ordinary fixes skip a new ADR.
- Never mix branches inside one plan → prepare → check → publish sequence.
- When the project declares a terminal `literate-ai.document-pair` Component,
  regenerate that pair (follow its authoring-package skill) after all code and
  specification changes have landed but before `prepare` on every major or
  minor cut — the pair is derived from current authority and must reflect the
  final release content, not a planning-stage snapshot. Patch cuts do not
  regenerate; they keep README citations on the last major/minor edition of
  the published presentation and narrative. A skipped minor is recovered on
  the next published cut of that line rather than by retagging.
- Prefer a clean upgrade path between consecutive minor releases. Run an
  installed-wheel upgrade smoke from the previous minor's latest published patch
  when the project policy or release queue makes compatibility a gate. A human
  release owner may explicitly defer that proof for a cut; record that decision,
  do not claim direct compatibility, and retain the migration or compatibility-patch
  follow-up. Major releases may break compatibility at the developers' discretion.

## Preserve authority

Never infer the version from an ambient tag. Never rewrite Component,
Flavor, skill, workflow, routing, schema, or protocol versions merely because
the distribution version changed. Never generate product claims from commit
messages. Never hide a remote race by rewriting history. Never store credentials
in project authority. A local tag is not proof of a successful push.
