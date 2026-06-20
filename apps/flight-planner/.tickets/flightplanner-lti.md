---
id: flightplanner-lti
status: closed
deps: []
links: []
created: 2025-12-17T19:50:40.86761-05:00
type: bug
priority: 3
mac-task-id: task_314f015ee3c5432580902941706d1dc6
---
# We are not using the standard key names

WARN[0000] The "VITE_OPENWEATHERMAP_API_KEY" variable is not set. Defaulting to a blank string.

## Close Reason

Avoid compose warnings by defaulting VITE_OPENWEATHERMAP_API_KEY to OPENWEATHERMAP_API_KEY and accept legacy env names in backend Settings
