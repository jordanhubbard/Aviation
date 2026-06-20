---
id: flightplanner-w2f
status: closed
deps: []
links: []
created: 2025-12-20T13:48:43.270174-05:00
type: epic
priority: 1
mac-task-id: task_9b5c9db1b844494690406592fdfe2319
---
# Real-time flight planning progress + backend parallelization

Production /api/plan can exceed the frontend 30s timeout. Build a multi-phase upgrade: (1) instrument and reduce latency (batch METAR/IO, timing logs), (2) add a streaming planning endpoint that emits progress + partial route legs, (3) update frontend to display progress and draw the route incrementally, (4) harden with concurrency limits, cancellation, and scaling knobs (uvicorn workers/executors).

## Close Reason

Implemented progress streaming + UI, concurrency/timeouts, and initial latency optimizations
