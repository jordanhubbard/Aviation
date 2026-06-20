---
id: flightplanner-37d.4
status: closed
deps: []
links: []
created: 2025-12-17T13:25:41.257319-05:00
type: task
priority: 0
parent: flightplanner-37d
mac-task-id: task_c3824291949f4b32aac4488f73311f46
---
# Implement mode selection endpoint

Create /api/plan endpoint that accepts mode parameter ('local' or 'route') and routes to appropriate planning logic

## Close Reason

Added /api/plan endpoint with discriminated union request and delegating to route/local planning
