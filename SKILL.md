---
name: literate-ai
description: Use Literate AI to create, change, generate, validate, build, test, review, or explain specification-led Components, Flavors, skills, workflows, routing policies, and project layouts. Use whenever a repository contains literate.project.json or the user asks to work with Literate AI.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Literate AI

Treat specifications as application authority and generated source as replaceable
derived output. The operator front door is `litai doctor`, then
`litai onboard create` for a new tree or `litai onboard adopt` for an existing
tree. Inspect the read-only plan, apply only with acknowledgement, and use
`litai status` for the next evidence-gated verb. The lower-level `litai init` and
`litai init --convert` mutators remain available. Run `litai help` for flags,
errors, and identity rules. Do not restate those in this file.

## Keep Windows-portable paths

Use short, shallow, conservative names. Windows `MAX_PATH` is 260 characters for the
full absolute path. Applications can declare long-path awareness, and a machine's
registry can be changed to match, but do not assume the target host has done either.
Avoid reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`,
`LPT1`–`LPT9`), characters `<>:"/\|?*`, and trailing dots or spaces in any segment.

## Follow agent skills by path

Do not copy `skills/agent/` into this file. `skills/agent/SKILL.md` is the parent
catalog: wrap `litai`, keep nested skills as deltas, and open **only** the nested
`SKILL.md` that matches the current task. There is no persistent Literate AI daemon.
Follow `skills/agent/configure-operator-mcp/SKILL.md` for the operator catalog;
`skills/agent/associate-release-jira/SKILL.md` and
`skills/agent/ingest-channel-work/SKILL.md` when those MCPs apply. Mutagenic posts
are `litai`'s job after journal success; do not re-post envelopes the CLI already
sent.

## Follow the project flow

1. If `PROJECT.md` exists, treat it as the durable goals record; `docs/` is
   subordinate. Follow `skills/agent/record-user-directed-work/SKILL.md` before
   substantive implementation. When a derived project discovers reusable parent-owned
   work, search or file the sanitized upstream issue before implementation as that
   record skill requires; issue creation does not authorize later external writes.
   At the start and end of a `dev` cycle, follow
   `skills/agent/develop-in-production-workflow/staging/dev/survey-peer-work/SKILL.md`.
   When a user works directly through Literate AI or a supported coding agent, use
   `skills/agent/prompt-master/SKILL.md` or `litai prompt translate`. Do not apply
   that translation to a task envelope an external task system already translated
   (`LITAI_EXTERNAL_TASK_ID`); that system owns its task-to-provider translation.
   By default the forge hosting the repository that receives issues and pull
   requests (GitHub or GitLab) is the project's tracker: report problems as issues,
   submit changes as PRs/MRs against the target branch that
   `litai project guidance --operation land` names, and coordinate with other agents
   through issues. Another tracker or review system (for example Gerrit) is a project
   or user override, never the default.
2. Run `litai verify` for declared gates in one call. `litai rebuild` produces the
   artifact. `litai update` reconciles inherited and framework files; `litai reparent`
   changes parent authority. After an intentional non-editable framework-wheel upgrade,
   use the reviewed `litai project lifecycle rebind-standard` plan/apply flow before
   rebuild; never hand-edit or silently advance a Standard distribution pin during
   update. `litai project validate` is the authority gate alone. `litai onboard`
   calls the existing `litai init` / `litai init --convert` mutators after an
   acknowledged, revalidated plan. Those mutators and `litai catalog copy` own their
   selectors and fail-closed collisions. Treat the conversion report as the exact follow-up
   queue; the initialized subset does not embed the framework-only conversion skill.
3. Read the selected `component.md`, local behavioral documents, direct public
   interface contracts, and acceptance contract. `litai lock` and `litai plan` own
   resolution and identities.
4. Change specifications, Flavors, or pinned skills to change intent. Generated
   source lives under advisory `BUILD_DIR`/`OBJ_DIR`; see
   `skills/specification-to-source/repository-layout/SKILL.md`.
5. Obtain acknowledgement before compiling or running generated host code. Use
   `litai rebuild` for the authorized lifecycle and `litai generate` only to stop at
   source. Cache hits stay untrusted until current acceptance.
6. Follow `skills/agent/configure-test-workers/SKILL.md` for private workers.
   Observations never replace authored routing requirements.
7. Long ladders checkpoint under ignored `OBJ_DIR`. A resumed repair is not release
   attestation.
8. For a release, follow `skills/agent/release-project/SKILL.md` and
   `literate.release.json`. Land through
   `skills/agent/develop-in-production-workflow/staging/dev/land/SKILL.md`.
   Packaging is `skills/agent/package-artifacts/SKILL.md`. Use the installed CLI's
   host-tool preflight; that framework-maintainer skill is not in this subset.
    Rendered frontend inspection is
    `skills/agent/verify-frontend-browser/SKILL.md` after execution authorization.

This is a derived project: use the installed `litai` CLI plus this project's
declared package metadata, locks, Flavors, and test configuration. Do not assume
the framework's `Makefile` or contributor bootstrap scripts.

After successful initialization, adoption, update or reparenting, follow
`skills/agent/maintain-parent-readme/SKILL.md` to reconcile the root README's
links to the project's actual declared parents. Also run
`litai project agent-entrypoints PATH`. Resolve its missing, stale or unsafe owned
entry points through reviewed authored changes to the declared `agent_skill`
before treating onboarding as complete. Preserve custom instructions and
independent children; the audit never repairs parent or retained-source trees.

## Author specifications without boilerplate

Begin a Component with one readable `component.md`. Exact resolution belongs in
generated `component.lock.json`. Put OS, language, toolchain, packaging, and
build-system choices in Flavors; conversion practice in exact skills;
cross-Component relationships in capability requirements and public contracts.

## Preserve authority boundaries

- Specifications decide observable behavior; Flavors decide target requirements;
  pinned skills guide conversion technique.
- Fix a defect where its authority lives. Skill preferences yield to explicit
  specification and Flavor requirements.
- Fail closed on missing authority, digest drift, dependency mismatch, ambiguous
  Flavors, sandbox weakening, or generated application output outside the
  authorized workspace.

## Read only the relevant detail

Use the project definition's `documentation_roots`. Start with the
[project guide](docs/README.md). `litai project validate` checks that declared
documentation and onboarding links remain current. Do not copy detailed protocols
into this entry point.
