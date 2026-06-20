---
id: Aviation-hd5
status: closed
deps: [Aviation-7bp]
links: []
created: 2026-01-17T18:01:40.405993-08:00
type: epic
priority: 1
mac-task-id: task_c1d9d83b34b44f4e98356c6870f994c8
---
# Auto-file P1 beads from runtime errors/crashes

Build an auto-filer that creates P1 Beads issues when runtime failures are detected: (1) any Python traceback in container logs; (2) frontend detects HTTP errors reaching backend or missing key route; (3) supervised child-process crash (supervisor monitors child as part of container launch; add supervisors where needed); (4) any child process spawned by any app exits non-zero. Auto-filed issues must be created in the monorepo Beads DB with priority P1 and include a comment prefixed '[auto-filed]' plus captured context (app/service, container, timestamp, stack trace/log excerpt, request/URL where relevant) with dedupe/rate limiting to avoid spam.

## Acceptance Criteria

For each trigger, injecting a synthetic failure results in a P1 bead in the repo Beads DB and an added comment starting with '[auto-filed]' containing actionable triage context.

## Close Reason

Implemented shared error SDK + wired crash/fetch/supervisor reporting to auto-file P1 beads
