---
id: Aviation-0te
status: closed
deps: []
links: []
created: 2026-01-16T19:23:23.308925-08:00
type: bug
priority: 2
mac-task-id: task_6dae05c38554451b8d3bb4549b9e2e43
---
# Root path returns 404 for aviation-accidents

Expected the aviation-accidents service to serve its top page at /.

Observed:
- https://aviation-accidents-production.up.railway.app returned HTTP 404 (curl).

Fix:
- Ensure root path renders the application top page instead of 404.

## Close Reason

Verified root paths and deployments working
