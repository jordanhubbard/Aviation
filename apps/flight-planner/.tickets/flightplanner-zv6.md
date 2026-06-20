---
id: flightplanner-zv6
status: closed
deps: []
links: []
created: 2025-12-20T13:49:08.030555-05:00
type: feature
priority: 1
mac-task-id: task_01b37870859c430cb8ff21b2e6e43508
---
# Backend: streaming flight planning endpoint (SSE)

Add an SSE endpoint that emits one-line progress messages and partial route legs/segments so the UI can update in real time.

## Close Reason

Added POST /api/plan/stream SSE endpoint emitting progress + partial/done events
