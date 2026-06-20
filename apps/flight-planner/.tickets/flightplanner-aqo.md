---
id: flightplanner-aqo
status: closed
deps: []
links: []
created: 2025-12-21T07:15:21.548167-05:00
type: feature
priority: 2
mac-task-id: task_1c53550c11b74f6983f05c64b4594fc4
---
# Planning: default planning date/time to current UTC

Add automatic UTC timestamps for all planning data (e.g., new plans/legs/waypoints/forecasts) using current time in UTC at creation/update where appropriate.

Acceptance:
- New planning entities get UTC date/time defaults (server-side).
- Stored values are timezone-unambiguous (UTC) and consistently serialized.
- Existing records are handled (migration/backfill strategy documented in code or separate issue if large).
- UI displays remain correct while underlying storage is UTC.

## Close Reason

Duplicate of flightplanner-1g9; consolidated UTC planning timestamp work there.
