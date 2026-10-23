---
name: ci-test-impact
description: >
  Author changed-code CI test selection from litai project ci-plan --mode
  impact, failing closed to the full suite when the impact map is missing or
  untrusted. Use when CI should skip tests whose covered code did not change.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# CI impact selection

Parent `ci-test-plan` owns detection and composition. This delta only authors
impact wiring.

1. Run `litai project ci-plan PATH --mode impact`.
2. If `fail_closed_to_full_suite` is true or `impact_map_trusted` is false,
   keep the full suite. Do not skip tests. `scripts/run_impact_pytest.py`
   passes `--no-testmon` when the map, `.testmondata.identity.json`, or
   pytest-testmon plugin is missing, or when `base_revision` is not an
   ancestor of HEAD.
3. If `impact.status` is `available`, persist `.testmondata` plus the identity
   sidecar with `python scripts/run_impact_pytest.py --refresh --`. Never treat
   `.test_durations` as a skip map; durations seed shards only.
4. Release gates (`make python-check`, `RELEASE_GATES`) stay the full suite.
   Do not pass `--testmon` or `select_smoke_tests.py` into those jobs.
5. If `impact.status` is `unavailable` or `unverified`, say so and leave
   selection unchanged. Do not call commercial impact products from repository
   CI.

When both impact and shard exist, author impact first, then shard the
remaining set using the parent compose plan.
