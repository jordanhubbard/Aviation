---
id: Aviation-mjg
status: closed
deps: []
links: []
created: 2026-01-16T19:23:33.689524-08:00
type: bug
priority: 2
mac-task-id: task_bbf84f1473f740359d52c9bb3e024264
---
# Root path returns 502 for weather-briefing

Expected the weather-briefing service to serve its top page at /.

Observed:
- https://weather-briefing-production.up.railway.app returned HTTP 502 (curl).

Fix:
- Ensure the service responds on the root path with the application top page.

## Close Reason

Verified root paths and deployments working
