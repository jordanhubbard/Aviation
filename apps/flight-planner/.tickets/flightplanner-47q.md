---
id: flightplanner-47q
status: closed
deps: []
links: []
created: 2025-12-18T03:19:18.339048-05:00
type: feature
priority: 1
mac-task-id: task_c1ce2cd177934f798778bd00d9f5a3d1
---
# Auto-create bd issues from frontend/backend errors

Implement a common bead issue creation handler in the backend and expose an API endpoint that the frontend can POST to. Backend should report unhandled exceptions/tracebacks and optionally error log events; frontend should report global errors and React ErrorBoundary catches. Activate only in local/dev when bd CLI is available; dedupe/throttle to avoid issue spam. Optional: install bd into container via build arg.

## Close Reason

Added backend beads reporter + /api/beads endpoints; frontend now reports React/global/axios errors to backend for bd issue creation. Enabled in local debug when bd available with dedupe/throttle and test/CI safeguards; Dockerfiles optionally install bd and include .beads.
