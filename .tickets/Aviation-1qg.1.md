---
id: Aviation-1qg.1
status: closed
deps: []
links: []
created: 2026-01-15T00:15:14.011633-08:00
type: task
priority: 0
parent: Aviation-1qg
mac-task-id: task_621f85fe85dd4511a0c516ae3927cc51
---
# Create Docker infrastructure for 4 apps missing it

Create complete Docker and docker-compose infrastructure for the 4 apps that don't have it yet.

Apps needing Docker infrastructure:
1. [ ] aviation-accident-tracker (TypeScript backend + React frontend)
2. [ ] flight-tracker (TypeScript backend)
3. [ ] flightschool (Python/Flask backend)
4. [ ] weather-briefing (TypeScript backend)

Per-app deliverables:
- Dockerfile(s) for backend (and frontend if applicable)
- docker-compose.yml for development
- docker-compose.test.yml for testing
- .dockerignore file
- Health check endpoints
- Environment variable documentation

Standard pattern to follow (from flightplanner/foreflight):
- Multi-stage builds
- Separate backend/frontend services
- Health checks
- Volume mounts for development
- Port mapping
