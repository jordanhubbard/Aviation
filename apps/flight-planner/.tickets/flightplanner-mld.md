---
id: flightplanner-mld
status: closed
deps: []
links: []
created: 2025-12-18T15:28:37.90231-05:00
type: bug
priority: 1
mac-task-id: task_695056a8305043b8a01243dfdd8c53c1
---
# Railway deploy: bind to 0.0.0.0 by default

Railway deployment shows uvicorn running on http://[::]:PORT and then container is stopped. Suspect health checks / routing use IPv4 and don't reach IPv6-only bind. Update Dockerfile(s) to bind uvicorn to 0.0.0.0 by default (optionally configurable via env var) so Railway can route traffic reliably.

## Close Reason

Default uvicorn bind host in Dockerfile(s) changed to 0.0.0.0 for Railway compatibility; allow override via UVICORN_HOST (e.g. ::).
