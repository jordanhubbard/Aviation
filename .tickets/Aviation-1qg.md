---
id: Aviation-1qg
status: closed
deps: []
links: []
created: 2026-01-15T00:13:43.581061-08:00
type: epic
priority: 0
mac-task-id: task_bfe8f563a2364d1c8d65cf0828e4ecfd
---
# Pre-Meta-App: Audit and fix standalone app deployments

Before building the meta-app, ensure each of the 7 aviation applications works correctly as a standalone containerized application.

**Audit Checklist per App:**
1. [ ] Docker Compose exists and follows consistent patterns
2. [ ] Can deploy individually to Railway.com
3. [ ] Tests run in containers via 'make test'
4. [ ] All dependencies work post-SDK migration
5. [ ] Health checks configured
6. [ ] Environment variables documented

**Apps to Audit:**
1. aviation-accident-tracker
2. aviation-missions-app (deployed, sleeping)
3. flight-tracker
4. flightplanner (deployed, sleeping, 2 warnings)
5. flightschool
6. foreflight-dashboard (deployed, sleeping, 4 warnings)
7. weather-briefing

**Goals:**
- Consistent docker-compose.yml patterns
- All apps deployable to Railway from monorepo subdirectories
- Working containerized test suite
- Clear deployment documentation per app

**Railway Project:** https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd
