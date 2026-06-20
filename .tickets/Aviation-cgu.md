---
id: Aviation-cgu
status: closed
deps: []
links: []
created: 2026-01-13T15:23:10.477427-08:00
type: task
priority: 2
mac-task-id: task_bf1d4e3af6424515b9e326dce5a65c9a
---
# Migrate flight-tracker to use shared aviation SDK

**Epic Child: Aviation-q0h - Migrate Apps to Shared SDK**

Migrate flight-tracker to use shared SDK for airports and weather.

**Current State:**
- Minimal implementation (service.ts, index.ts)
- Likely needs airport/weather data

**Integration Points:**
- Add airport lookup → `@aviation/shared-sdk/aviation/airports`
- Add weather data → `@aviation/shared-sdk/aviation/weather`
- Add navigation utilities → `@aviation/shared-sdk/aviation/navigation`

**Migration Steps:**
1. [ ] Analyze current implementation
2. [ ] Add shared-sdk dependency
3. [ ] Implement airport lookups
4. [ ] Add weather integration
5. [ ] Use navigation utilities
6. [ ] Add tests
7. [ ] Update documentation

**Acceptance Criteria:**
- [ ] Using shared SDK for data
- [ ] All tests passing
- [ ] Build successful
- [ ] Documentation updated

**Estimated Effort:** 1-2 days
