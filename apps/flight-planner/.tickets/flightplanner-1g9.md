---
id: flightplanner-1g9
status: closed
deps: []
links: []
created: 2025-12-21T07:15:01.748361-05:00
type: feature
priority: 2
mac-task-id: task_1c060f849ac24d11946af9f84fa2bb18
---
# Add UTC times/dates to all planning data

Add UTC-based timestamps (date + time) derived from the current time for all planning data records/outputs so planning is consistent across time zones.\n\nAcceptance:\n- Planning data includes a UTC timestamp (e.g., created_at/updated_at or computed ‘planned_at_utc’) wherever planning records are created/updated.\n- UI/export/API surfaces the UTC time/date consistently.\n- Tests updated/added where applicable.

## Close Reason

Added UTC timestamps to plan responses (planned/depart/arrival + per-leg depart/arrive) and displayed them in the UI.
