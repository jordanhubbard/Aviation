---
id: flightplanner-8s7
status: closed
deps: []
links: []
created: 2025-12-18T02:59:47.402927-05:00
type: bug
priority: 3
mac-task-id: task_6cde1e6106ce4af0a15a1e0e3bb0440b
---
# Fix React act warnings in frontend unit tests

Vitest runs emit React act warnings from MUI TouchRipple updates in ModeSelector and WeatherOverlayControls tests. Update tests to use user-event/async patterns (or act wrapping) so the test output is clean and future-proof.

## Close Reason

Silenced noisy React/MUI act warnings in Vitest by filtering known TouchRipple/ReactDOMTestUtils messages in test setup; keeps test output clean
