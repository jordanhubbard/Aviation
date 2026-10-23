---
name: release-project-evidence
description: Inspect or reclaim a release-gate evidence ledger with litai release evidence. Use when a release check fails, when diagnosing a gate, or when pruning old runs.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Release-gate evidence

Inherits `../SKILL.md`. Wrap `litai release evidence`. Do not grep `_build/`
or replay a completed expensive gate to learn why it failed.

## What to run

1. `litai release evidence explain` for the latest run, or `--run ID`.
2. `litai release evidence show NODE` for one reduced node (`n0001`).
3. `litai release evidence index` only when the compact index is missing.
4. `litai release evidence prune --keep N` only after a successful complete
   run and with operator authorization. Default keep is 1. Pass
   `--include-failed` only when reclaiming failed diagnostics.

A resumed repair is not release attestation. Let it finish the remaining named gates;
the checkpoint runner then clears repair progress and exits with rerun-required status
2. Repeat the same release check, and accept attestation only when that next invocation
evaluates from gate one and exits 0. Then publish only from a current prepared identity.
The retained release plan and verification must name the
derived release class and stable predecessor; contribution dispositions must
name their milestone; required collateral must bind its local source hashes,
stable provider IDs, publishing account, exported read-back hashes, and source
revision. Evidence from an earlier revision or release cycle is stale even when
its files still exist.
