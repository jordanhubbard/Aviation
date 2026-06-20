---
id: flightplanner-aqt
status: closed
deps: []
links: []
created: 2025-12-20T13:49:07.788168-05:00
type: task
priority: 1
mac-task-id: task_2dea7e29a5a44d21925017951455c224
---
# Batch METAR fetching for alternates

Reduce /api/plan latency by fetching multiple METARs in one request (or concurrently) and caching results; update recommend_alternates to avoid sequential 15x HTTP calls.

## Close Reason

Batch METAR fetch for alternates to avoid sequential HTTP calls
