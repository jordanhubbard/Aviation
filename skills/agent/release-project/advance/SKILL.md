---
name: release-project-advance
description: Advance the default branch version past every released tag after a line cut. Use after litai release publish when main still reports a shipped version.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Advance the default branch

Inherits `../SKILL.md`. Wrap `litai release advance-default-branch`. The
command writes declared version files only; it never commits or pushes.

## When this runs

After `publish` on `release/<major>.<minor>.x`, inspect the receipt field
`default_branch_advance`. If it is `skipped` because this checkout is not
the default branch, or `failed`, do not ignore it.

1. Check out the policy `default_branch` in a clean worktree.
2. `litai release advance-default-branch --branch BRANCH --bump minor|major`
   (or `--version`). Use minor after a patch or minor cut; major only when
   the operator scheduled a major.
3. Review the diff, commit on that branch, and push without force.

Do not run this as a substitute for `prepare` on the release line.
