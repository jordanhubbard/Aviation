---
id: Aviation-lu9
status: closed
deps: []
links: []
created: 2026-01-16T19:23:28.247997-08:00
type: bug
priority: 2
mac-task-id: task_99ed0df82fc540d7b5066ddeae044aa5
---
# Root path returns 502 for flight-tracker

Expected the flight-tracker service to serve its top page at /.

Observed:
- https://flight-tracker-production-384f.up.railway.app returned HTTP 502 (curl).

Fix:
- Ensure the service responds on the root path with the application top page.

## Close Reason

Verified root paths and deployments working
