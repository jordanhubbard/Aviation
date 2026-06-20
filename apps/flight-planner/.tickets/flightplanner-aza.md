---
id: flightplanner-aza
status: closed
deps: []
links: []
created: 2025-12-17T21:23:39.212111-05:00
type: bug
priority: 1
mac-task-id: task_0344ee2d9fa747f986e9d67e6a9294ae
---
# Fix OpenTopography terrain requests (bbox too small)

Terrain API calls to OpenTopography were failing with 400 'selected area is too small'; adjust bbox sizing and parse AAIGrid correctly.

## Close Reason

Increased OpenTopography bbox size and added AAIGrid parsing to select the correct cell; terrain endpoints now return 200 instead of 503
