---
id: flightplanner-0h0
status: closed
deps: []
links: []
created: 2025-12-18T08:43:29.612913-05:00
type: bug
priority: 1
mac-task-id: task_962cbdecfad542708dbacde57c498263
---
# Wind barbs not rendering on route map

User enables Wind overlay but sees no wind barbs on Route Results map. Investigate RouteMap + useRouteWeather rendering logic and backend /api/route-weather points response; ensure barbs are visible and rendered.

## Close Reason

Route wind barbs were easy to miss / could be absent when route polyline had only endpoints. Backend /api/weather/route now resamples/densifies along the polyline up to max_points, and RouteMap renders barbs with a white background circle for visibility. Added regression test for 2-point routes.
