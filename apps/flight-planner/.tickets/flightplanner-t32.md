---
id: flightplanner-t32
status: closed
deps: []
links: []
created: 2025-12-20T13:49:08.276298-05:00
type: task
priority: 1
mac-task-id: task_ed479b1a54ca48caa447d78f16a9c324
---
# Backend concurrency/scaling knobs

Add safe parallelism: async IO for external calls, bounded concurrency, optional uvicorn workers via env, and threadpool offloading for CPU-bound geospatial steps.

## Close Reason

Added planning concurrency limits + external worker pool + uvicorn workers env knob
