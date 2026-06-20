---
id: flightplanner-a8b
status: closed
deps: []
links: []
created: 2025-12-20T16:24:06.537131-05:00
type: bug
priority: 0
mac-task-id: task_f603d29c1efb41549d8aad0b3d4a4197
---
# Terrain calls timing out / failing in prod due to OpenTopography quota

In production, /api/plan with avoid_terrain can take ~22s and then later fails with OpenTopography 401: 'API maximum rate limit reached (50 API calls/24hrs)'. ElevationProfile also calls /api/terrain/profile with up to ~60 points which can burn quota quickly. Fix by switching terrain point/profile + avoid_terrain checks to use Open-Meteo elevation API (bulk, no key) by default, with optional OpenTopography fallback via env.

## Close Reason

Switched default terrain provider to Open-Meteo elevation to avoid OpenTopography quota/timeouts
