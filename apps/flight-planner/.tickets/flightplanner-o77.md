---
id: flightplanner-o77
status: closed
deps: []
links: []
created: 2025-12-20T14:33:32.201547-05:00
type: bug
priority: 1
mac-task-id: task_7c96972c97dc42ccab9a5f1ee0cb0616
---
# Support FAA/local airport codes like 7S5

Currently validation/lookup assumes airport codes are letters-only (IATA/ICAO). FAA local identifiers like 7S5 should be accepted in the UI and resolved in backend lookups (e.g., map 7S5 -> K7S5 in our airport cache).

## Close Reason

Allow alphanumeric airport codes in UI; resolve FAA code 7S5 via K7S5 mapping
