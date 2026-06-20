---
id: flightplanner-ff5
status: closed
deps: []
links: []
created: 2025-12-20T18:46:38.961447-05:00
type: feature
priority: 2
mac-task-id: task_05a61e29697b45e781f97e566cf5bb2c
---
# Flight log: highlight fuel stops + per-leg elapsed time

Enhancement: In the route results flight log/legs table, visually mark fuel stop legs (i.e., legs that end at a fuel stop waypoint) in a distinct color. Also compute and display cumulative elapsed flight time per leg relative to departure: for each leg, estimate time from predicted distance and wind-adjusted groundspeed (use route wind speed/direction + per-leg bearing to compute headwind component; fallback to cruise speed). Add +30 minutes after each fuel-stop arrival for refueling before the next leg. Record/show final total elapsed time at the last leg.

## Close Reason

Added per-leg elapsed timing with refuel padding and highlighted fuel stop legs in flight log
