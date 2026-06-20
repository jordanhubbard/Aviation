---
id: flightplanner-ou0
status: closed
deps: []
links: []
created: 2025-12-17T20:41:36.195813-05:00
type: feature
priority: 1
mac-task-id: task_52894652c35a4fefa4957bb3bdf7dff2
---
# Add startup check for missing external API keys

During backend service startup, detect missing API keys that will cause feature endpoints to fail (e.g. OpenWeatherMap, OpenTopography) and log remediation steps; expose these warnings via /api/health.

## Close Reason

Added backend startup config checks for missing OpenWeatherMap/OpenTopography keys, logs remediation steps, and exposes warnings via /api/health
