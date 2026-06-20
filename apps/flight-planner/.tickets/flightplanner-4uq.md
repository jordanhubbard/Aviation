---
id: flightplanner-4uq
status: closed
deps: []
links: []
created: 2025-12-20T14:33:32.331802-05:00
type: feature
priority: 1
mac-task-id: task_047dbe7956bd4992b8fa4c4e017916bb
---
# Fuel stop planning inputs (fuel on board + burn + reserve)

Expose fuel stop planning in the route planner UI: add checkbox + fields for fuel burn (gph), fuel on board at takeoff (gal), and reserve minutes (default 45). Backend should compute per-leg range using reserve and plan fuel stops accordingly.

## Close Reason

Added fuel stop UI inputs and backend range calculation using fuel on board + reserve
