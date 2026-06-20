---
id: flightplanner-wnn
status: closed
deps: []
links: []
created: 2025-12-18T06:10:13.779816-05:00
type: bug
priority: 1
mac-task-id: task_787d8f3387204533b0c8d60795ca5623
---
# Fix avoid_airspaces route truncation (destination dropped)

When avoid_airspaces is enabled, xctry_route_planner.avoid_airspaces can truncate the route after inserting an offset point: it breaks out of the loop without appending the remaining tail of points, so subsequent iterations can drop the destination, yielding absurdly short distances (e.g., KPAO→KUKI shows ~10nm). Fix to preserve route_points[i+1:] when inserting detour points and avoid creating zero-length final segments.

## Close Reason

Fixed airspace avoidance detour insertion to preserve remaining route points (including destination) and dedupe consecutive duplicates; added regression test so avoid_airspaces cannot truncate routes (KPAO→KUKI now ~124nm with avoid_airspaces enabled).
