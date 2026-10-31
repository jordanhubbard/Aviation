---
name: release-project-ci-status
description: Wait for green hosted CI before planning a release cut. Use before litai release plan, before merging a land PR, or when a remote matrix must pass.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Wait for green CI

Inherits `../SKILL.md`. Wrap `litai project tracker inspect` and the
`ci_status` argv it names. Do not invent `gh` or `glab` flags. Authoring
shard YAML is `ci-test-plan`, not this skill.

## What to run

1. `litai project tracker inspect`. If `ci_status` is empty (`unsupported`
   or `ambiguous`), record a named skip. Do not treat local tests as the
   remote matrix.
2. Run the exact `ci_status` argv. GitHub lists runs for `HEAD`; GitLab
   reports pipeline status for the current checkout.
3. Fail closed on `failure`, `cancelled`, or a red pipeline. That blocks
   `litai release plan` and `land` merge.
4. Pending/in-progress is wait, not pass. Re-run the same argv; do not
   start a second CI system.

A clean local `make` target is necessary, never sufficient, for production
posture or a versioned cut. When the release policy declares `qualification`,
`litai release qualify` is the authority instead: a record whose host and
worker tiers cover every platform and action makes CI optional for that exact
revision. CI is required only for cells no left tier covers or when the policy
marks CI mandatory, and a completed failing CI run still blocks.
