---
name: track-project-requirements
description: Read and maintain a project's root PROJECT.md as the durable source of truth for its high-level goals and completeness, ahead of docs/ and the active-work.md execution queue. Use before authoring or changing any Component, Flavor, or skill, and whenever PROJECT.md's goals change.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Track project requirements

`PROJECT.md`, at a project's root, is the durable source of truth for what the project
is for and how complete its implementation is against that purpose, stated in terms of
generated Components, Flavors, and skills. Every file under `docs/` is subordinate to
it: a `docs/` document may detail or justify a decision, but the goals and completeness
state `PROJECT.md` records are authoritative over it. `docs/roadmap/active-work.md` is
the tactical execution queue beneath `PROJECT.md` — every queue item should trace back
to a goal recorded there.

## Before authoring

Read `PROJECT.md` first, before writing or changing any Component, Flavor, or skill. If
it declares a blocking dependency on another repository's own `PROJECT.md` goals being
finalized, and that dependency is unmet, stop and say so explicitly — for example, "I
need `<repository>` to have its own `PROJECT.md` goals finalized before I can start this
work" — rather than proceeding around it. A project without `PROJECT.md` has not adopted
this convention; its absence is not blocking, but create one when the work at hand is
substantial enough to need durable goal tracking.

## When PROJECT.md changes

When a goal is added, narrowed, or checked off in `PROJECT.md`, decide whether the
change needs a new detailed plan under `docs/roadmap/` or only an addition to the
existing backlog in `docs/roadmap/active-work.md`, following
`skills/agent/record-user-directed-work/SKILL.md`'s rule for when a program earns its
own file. Update `PROJECT.md` itself as work items are checked off so it stays a live
completeness dashboard, not a one-time snapshot, rather than letting completion state
drift into `active-work.md` alone.

## Structure

Keep `PROJECT.md` to these sections: **Goals** (why the project exists, stated at
product-behavior level, not implementation detail), **Dependencies** (blocking
relationships on other repositories' `PROJECT.md`, or "None"), **Completeness** (current
Component/Flavor/skill inventory against the goals), **Current work** (pointer to the
live `active-work.md` queue plus any notable open threads), and **Completed work**
(pointer to the changelog plus milestones tied directly to a goal above).
