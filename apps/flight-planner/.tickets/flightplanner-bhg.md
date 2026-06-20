---
id: flightplanner-bhg
status: closed
deps: []
links: []
created: 2025-12-20T13:49:07.908825-05:00
type: task
priority: 2
mac-task-id: task_9d390bc14e2248cdb072703ae9c32ac3
---
# Increase frontend plan request timeout (configurable)

Raise the Axios timeout for long-running planning calls (or make it per-request) to avoid premature 30s client aborts while backend work is optimized.

## Close Reason

Increased frontend API timeout to 120s
