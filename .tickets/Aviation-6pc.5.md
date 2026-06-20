---
id: Aviation-6pc.5
status: closed
deps: []
links: []
created: 2026-01-15T00:05:46.600781-08:00
type: task
priority: 1
parent: Aviation-6pc
mac-task-id: task_aaf0ffb7bfab4c4bbfae07d842384f4b
---
# Create unified Docker Compose orchestration

Create root-level docker-compose.yml to orchestrate all aviation applications as a suite.

**Tasks:**
- [ ] Create root docker-compose.yml
- [ ] Define services for all 7 apps (backends)
- [ ] Define service for meta-app frontend
- [ ] Define service for API gateway/reverse proxy
- [ ] Set up shared network
- [ ] Configure health checks
- [ ] Set up volumes for persistence
- [ ] Configure environment variables
- [ ] Add Redis for session storage
- [ ] Add monitoring services integration
- [ ] Document service dependencies

**Services to orchestrate:**
- aviation-suite (meta-app frontend)
- api-gateway (nginx/traefik)
- accident-tracker-backend
- missions-app-backend
- flight-tracker-backend
- flightplanner-backend
- flightschool-backend
- foreflight-backend
- weather-briefing-backend
- redis (session store)
- postgres (if needed for shared DB)

**Deliverables:**
- docker-compose.yml (root level)
- Service configuration
- Network setup
- Documentation
