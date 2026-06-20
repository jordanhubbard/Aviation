---
id: Aviation-6pc.8
status: closed
deps: []
links: []
created: 2026-01-15T00:06:16.649242-08:00
type: task
priority: 1
parent: Aviation-6pc
mac-task-id: task_d9e831c845104046a9cf091a5964acba
---
# Add Dockerfiles for all backend services

All 7 apps now have Dockerfiles in apps/*/Dockerfile:
- aviation-accident-tracker
- aviation-missions-app
- flight-tracker
- flight-planner
- flightschool
- foreflight-dashboard
- weather-briefing

Dockerfiles include multi-stage builds, health checks, and production-ready configs. Verified via glob search.

Status: completed.
