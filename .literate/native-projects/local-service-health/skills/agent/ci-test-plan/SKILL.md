---
name: ci-test-plan
description: >
  Detect a project's test frameworks and emit a fail-closed CI shard and
  impact-selection plan. Use when a CI job runs the whole suite serially, when
  adding durations-based sharding or changed-code test selection, or when a
  language Flavor's test runner needs an explicit "not available" result instead
  of a silent no-op.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# CI test plan

For complex projects where minimum turnaround matters, prefer user-supplied runners over hosted CI/CD workers: the host running the coding CLI first, then aligned `workers.json` workers, and CI/CD only for platform and action cells those cannot cover or when the project marks CI mandatory. See `skills/agent/align-workers/SKILL.md`.

Run `litai project ci-plan [PATH] [--mode shard|impact|compose]`. Python owns
framework detection, the per-framework availability table, durations-seed vs
native-partition notes, and fail-closed impact selection. Nested `shard` and
`impact` skills are deltas of this file.

## Judgment Python cannot encode

1. Do not invent a shard or impact mechanism the plan marked `unavailable` or
   `unverified`. Say so in the queue item and stop, or keep the full suite.
2. Compose as **impact, then shard what remains**. An untrusted, missing, or
   stale impact map selects the full suite, then shards if a shard mechanism
   exists. Never ship a truncated suite from an unverified map.
3. Do not shard jobs whose plan reports `checkpoint_jobs.decision: keep_unsharded`.
   This repository's Linux/macOS `make` unittest runner is that case: linear
   prefix resume cannot accept out-of-order shard workers. Windows pytest-split
   stays the durations shard.
4. Author CI YAML only from the plan's `mechanism`, `refresh`, and
   `already_authored` fields. Do not copy hostnames, credentials, or private
   worker destinations into the workflow.
5. Never skip tests from `.test_durations` or a smoke subset. Durations files
   only seed sharding. Release gates (`make python-check`, `RELEASE_GATES`)
   keep the full suite even when an impact map exists.

This skill never enters a generation prompt and cannot weaken release gates.
