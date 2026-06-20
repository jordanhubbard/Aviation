---
id: Aviation-u90
status: closed
deps: []
links: []
created: 2026-01-13T15:23:17.594184-08:00
type: task
priority: 2
mac-task-id: task_eb9cf9a5de944c3ba171f94cc88f82d4
---
# Migrate weather-briefing to use shared weather SDK

**Epic Child: Aviation-q0h - Migrate Apps to Shared SDK**

Migrate weather-briefing to use shared weather services.

**Integration Points:**
- Replace local weather code → `@aviation/shared-sdk/aviation/weather`
- Add airport lookup → `@aviation/shared-sdk/aviation/airports`

**Migration Steps:**
1. [ ] Analyze current weather implementation
2. [ ] Add shared-sdk dependency
3. [ ] Replace weather services with shared SDK
4. [ ] Add airport lookups
5. [ ] Migrate API keys to keystore
6. [ ] Run tests
7. [ ] Update documentation

**Acceptance Criteria:**
- [ ] Using shared weather SDK
- [ ] All tests passing
- [ ] Build successful
- [ ] Feature parity maintained

**Estimated Effort:** 1-2 days
