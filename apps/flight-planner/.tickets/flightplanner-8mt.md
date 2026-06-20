---
id: flightplanner-8mt
status: closed
deps: []
links: []
created: 2025-12-18T03:01:42.004799-05:00
type: bug
priority: 1
mac-task-id: task_b7f4017f50e44e1695b0ab0169f2c05d
---
# Deduplicate or silence weather fetch errors for local map station queries

Local planning now fetches weather for many nearby airports to color status circles. If the weather endpoint errors (e.g. rate limit / missing key), the UI spams repeated 'Weather service error' toasts. Add a mechanism to silence background query errors and/or dedupe toasts (single error per time window).

## Close Reason

Add suppressToast support to axios apiClient error interceptor and use it for background local-map per-airport weather queries to prevent toast spam; also dedupe identical error toasts
