---
name: worker-health
description: Inspect configured execution workers before substantial jobs, while polling long jobs, and after resource failures; report capacity or overload and route disk incidents to bounded cleanup investigation without implying deletion permission.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Worker health

Use the framework command with the exact selected worker and its private policy:

```text
litai worker health --worker-id WORKER --worker-config WORKERS.json --health-config HEALTH.json --job-identity sha256:...
```

Run it before a substantial build, test, package, model, or native-toolchain job.
For long-running work, invoke the same bounded inspection from the workflow's
existing poll cycle. Run it again after disk-full, allocation, paging, GPU OOM,
timeout, or unexplained stalled-progress failures. Do not create a background daemon.

Treat `proceed`, `hold`, and `retry-after-recheck` as scheduling decisions, not
host-administration authority. A denied, unreachable, stale, malformed, or required
unsupported probe is unknown rather than healthy. High CPU or GPU utilization with
continuing progress is ordinary busy work; reduce only concurrency owned by the
current task when sustained pressure also affects progress or allocation.

A disk warning or critical finding automatically performs the configured bounded,
read-only candidate investigation. Report the worker alias, resource, measurements,
job impact, candidate identity, measured size, ownership evidence, active-use state,
uncertainty, recovery cost, and next action. Never expose private paths, endpoints,
credentials, or process arguments in a public report.

Candidate discovery never authorizes deletion. Unknown or active use is protected.
Cleanup requires a current authorization binding the exact worker, policy, proposal,
candidate identities, supported operation, and expiry. Revalidate each candidate and
link boundary immediately before the supported cleanup tool; then remeasure actual
capacity. Administrative access, release approval, or acceptance of a proposal does
not substitute for exact cleanup authorization. Never kill unrelated processes,
remove SDKs, source, datasets, checkpoints, or other users' files, or reboot a worker.

Retry a failed allocation only after a fresh inspection satisfies its footprint and
reserve. Obey the policy retry bound and stop unchanged install or cleanup loops.
Use `--alert-state` only for an explicitly selected private history file when
deduplicated escalation and recovery events are needed.

