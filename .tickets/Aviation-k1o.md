---
id: Aviation-k1o
status: closed
deps: []
links: []
created: 2026-01-17T14:35:26.178677-08:00
type: bug
priority: 2
mac-task-id: task_e2397234a9b646b382133e46e5e7d239
---
# Weather briefing: persist airport selection and refresh map

Fix airport selection UX in weather-briefing.

Problems:
- When a dropdown airport is selected, the text input retains the previous code and overrides the selection.
- If a user enters a new valid airport code, it should be added to the dropdown list for future use and persist across sessions.
- The map does not update when the airport changes.

Requested behavior:
- Selecting from dropdown should overwrite the text input with that airport code.
- Valid manual entry should add the code to the dropdown and persist (local storage or similar).
- Map should update when the airport selection changes (dropdown or manual input).

## Close Reason

Synced station dropdown/input, persisted custom stations, and updated map on airport change.
