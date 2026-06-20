---
id: Aviation-ttb
status: closed
deps: []
links: []
created: 2026-01-14T08:55:29.895219-08:00
type: task
priority: 2
mac-task-id: task_f8af80ea601343faaa7ed78fb27e7fec
---
# Add CI/CD workflow for automated deployments

Set up automated deployment pipeline:

**Current State:**
- CI/CD runs tests ✅
- No automated deployment ❌

**Deployment Workflow:**
1. On push to `main` → deploy to staging
2. On tag `v*` → deploy to production
3. Manual approval for production deploys

**Services to Deploy:**
- accident-tracker (backend + frontend)
- flightplanner (backend + frontend)
- flightschool
- foreflight-dashboard
- weather-briefing

**Workflow File:**
`.github/workflows/deploy.yml`

**Steps:**
1. Build Docker images
2. Run tests
3. Push to container registry
4. Deploy to Railway/Fly.io
5. Run smoke tests
6. Notify on Slack/Discord

**Priority:** P2 - DevOps
