---
id: flightplanner-7w7
status: closed
deps: []
links: []
created: 2025-12-17T20:52:25.676733-05:00
type: bug
priority: 1
mac-task-id: task_6530d2aa0c2c47b0aa048904ac40ee17
---
# Fix CI e2e failure (Route Results not visible)

GitHub Actions run 20323202530 fails Playwright test flight-planner.spec.ts waiting for 'Route Results'. Make the test robust (wait for /api/plan response and/or increase timeout) so CI is stable.

## Close Reason

Updated Playwright route-planning e2e to wait for /api/plan response (mode=route) and increased Route Results visibility timeout to avoid CI flake
