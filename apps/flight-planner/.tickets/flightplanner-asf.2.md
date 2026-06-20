---
id: flightplanner-asf.2
status: closed
deps: []
links: []
created: 2025-12-17T13:26:39.770228-05:00
type: task
priority: 0
parent: flightplanner-asf
mac-task-id: task_a4779a93a4f64f8b9c4545f0ead2305d
---
# Port cross-country route planning from xctry-planner

Extract and adapt route calculation algorithm, waypoint generation, and direct/optimized path logic

## Close Reason

Cross-country route planning logic is ported via app/services/xctry_route_planner.py and exposed at /api/route and /api/plan (mode=route)
