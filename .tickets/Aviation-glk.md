---
id: Aviation-glk
status: closed
deps: [Aviation-wvx]
links: []
created: 2026-01-13T11:25:26.926524-08:00
type: epic
priority: 1
mac-task-id: task_7bb8ce1b987945c1acad8657849c30e7
---
# Aviation Accident Tracker: API

REST API for events (list/filter/paginate), detail with sources, guarded ingest trigger, health/version, response shaping for map vs table, OpenAPI.

## Close Reason

API complete: GET /api/events with filtering/pagination, GET /api/events/:id detail with sources, POST /api/ingest/run with bearer token auth. Integrated with database repository. Health/version endpoints in app.ts.
