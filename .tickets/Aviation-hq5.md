---
id: Aviation-hq5
status: closed
deps: []
links: []
created: 2026-01-17T13:19:32.264401-08:00
type: task
priority: 2
mac-task-id: task_4cfdf69e79904ba9ba7d47e07b8b9479
---
# Verify Railway deployments and check for missing env vars

Run Railway CLI log/status checks for all services and confirm required environment variables are set for each app (compare against app config/README/.env requirements). Report any missing variables and add follow-up beads.

## Close Reason

Checked Railway variables across services; reported missing foreflight-dashboard and flightschool secrets and created follow-up beads.
