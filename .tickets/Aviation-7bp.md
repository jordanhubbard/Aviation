---
id: Aviation-7bp
status: closed
deps: []
links: []
created: 2026-01-17T18:04:34.601581-08:00
type: epic
priority: 1
mac-task-id: task_6d26c785481b40f8a6403d1372c7696b
---
# Central error-collection SDK + supervisor/worker audit

Complementary epic to Aviation-hd5: audit the monorepo for opportunities to introduce supervisor/worker (parent/child) process relationships across services (especially in containers) so crashes and non-zero child exits are detected reliably. Implement a shared error-collection SDK (Python + Node/TS + frontend hooks) that captures: (1) Python tracebacks from containerized apps, (2) frontend HTTP connectivity errors to backend and missing key routes, (3) supervisor-detected child crashes, and (4) any spawned child process non-zero exit. The SDK should be the single place that dedupes/rate-limits and files Beads issues (P1 where appropriate), adding comments prefixed with '[auto-filed]' and including full triage context.

## Acceptance Criteria

Across representative apps, injecting each failure mode results in an issue filed via the shared error SDK (not ad-hoc callers), with a comment starting '[auto-filed]' containing actionable context and dedupe preventing spam.

## Close Reason

Implemented shared error-reporting SDK + integrated into representative apps
