---
id: Aviation-6pc
status: closed
deps: []
links: []
created: 2026-01-15T00:04:59.127024-08:00
type: epic
priority: 1
mac-task-id: task_33097a01965c4339bd9dc8fdbecce2ab
---
# Aviation Suite: Meta-App with Multi-Tab UI

Create an 'app-of-apps' architecture where all aviation applications are accessible through a single unified frontend with tabbed interface, orchestrated via Docker Compose.

**Vision:**
- Single frontend container with tabbed UI showing all apps
- Each app backend runs in its own container
- Top-level Docker Compose orchestrates entire suite
- Seamless navigation between applications
- Unified authentication and session management

**Architecture:**
- Meta-app frontend (React + TypeScript)
- Tab navigation using @aviation/ui-framework
- Each app provides a 'pane' component for embedding
- API gateway/proxy for backend routing
- Docker Compose orchestration at monorepo root

**Deliverables:**
1. Meta-app application (apps/aviation-suite/)
2. Pane components for all 7 existing apps
3. Root docker-compose.yml for full suite
4. API gateway/reverse proxy
5. Documentation and deployment guide

**Benefits:**
- Single entry point for all aviation tools
- Shared authentication across apps
- Simplified deployment
- Better user experience
- Reduced resource usage
