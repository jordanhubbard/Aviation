---
name: ci-test-shard
description: >
  Author durations-based or native-partition CI test sharding from
  litai project ci-plan --mode shard. Use when one CI job is the long pole and
  a maintained shard mechanism exists for the detected framework.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# CI shard

Parent `ci-test-plan` owns detection and fail-closed composition. This delta
only authors a matrix split.

1. Run `litai project ci-plan PATH --mode shard`.
2. For each detected framework whose `shard.status` is `available`, write the
   named mechanism (durations seed plus refresh when `durations` is true;
   native partition when false). Skip frameworks already listed in
   `already_authored`.
3. For `unavailable`, record the plan's `note` in the work item. Do not wrap
   the suite in pytest-split, Jest `--shard`, or nextest `--partition` unless
   that framework was detected.

Do not shard `unittest-checkpoint` jobs. Follow the parent's checkpoint
decision.
