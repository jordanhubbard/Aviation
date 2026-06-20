---
id: Aviation-1qg.2
status: closed
deps: []
links: []
created: 2026-01-15T00:15:24.214617-08:00
type: task
priority: 0
parent: Aviation-1qg
mac-task-id: task_2e525fe20dde42f3b5aee9a773fb71bb
---
# Test and fix existing Docker deployments

Test the 3 apps that already have Docker infrastructure and fix any issues.

Apps to test:
1. [ ] aviation-missions-app - Test docker-compose, verify deployment
2. [ ] flightplanner - Test compose, investigate 2 Railway warnings
3. [ ] foreflight-dashboard - Test compose, investigate 4 Railway warnings

Per-app tasks:
- Run docker-compose up locally
- Verify all services start correctly
- Test health check endpoints
- Investigate Railway warnings
- Fix any broken functionality
- Verify SDK integration works
- Document any environment variables
- Test Railway deployment from monorepo

Current Railway deployments (all sleeping):
- aviation-missions-app: No warnings
- flightplanner: 2 warnings
- foreflight-dashboard: 4 warnings
