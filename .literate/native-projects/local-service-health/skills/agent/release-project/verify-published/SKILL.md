---
name: release-project-verify-published
description: Prove the remote tag, release line, and optional GitHub release match one prepared identity. Use after litai release publish or when recovering a partial publication.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Verify a published release

Inherits `../SKILL.md`. Wrap `litai release verify-published PREPARED`.
Python owns remote tag/branch/provider/collateral comparison. This command
writes nothing.

## What to run

1. After publish, or when inspecting a suspected partial publish, run
   `litai release verify-published PREPARED` with the same prepared record
   `check` wrote.
2. On `release.published_tag_missing` or `published_branch_mismatch`,
   inspect with `evidence explain` and the Git remote. Retry `publish`
   only when policy allows idempotent reuse of the exact annotated tag.
3. On `release.published_provider_missing`, Git publication may already
   have succeeded. Authenticate `gh` and retry publish; never retag.
4. Require a published provider release (`draft=false`) whose prerelease flag
   matches the exact prepared version, with non-empty release notes and every
   policy-required asset. Stable candidates must be stable; explicitly prepared
   prerelease candidates must be published prereleases.
   For a major/minor document pair, require the release-bound receipt and its
   exported read-back hashes to match the exact prepared revision.
5. Run a final `litai release contributions sweep` after remote verification.
   New work is not silently swept into the release that just shipped: classify
   it for the next milestone so the next cycle begins from durable state.
6. Never delete, move, overwrite, or force-push a published tag to make
   this command pass.

A local tag is not proof, and a provider URL is not proof that notes, assets,
or collateral match. Homebrew/formula SHA updates stay package publication
work; verify the policy-declared release surface rather than inferring success
from one remote object.
