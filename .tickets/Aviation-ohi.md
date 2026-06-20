---
id: Aviation-ohi
status: closed
deps: []
links: []
created: 2026-01-13T15:15:56.854124-08:00
type: task
priority: 2
mac-task-id: task_4b60916e295c47faa4a22db200af57fe
---
# Performance testing and optimization

**Epic: Tests - Performance**

Implement performance testing and optimize bottlenecks.

**Requirements:**
- Load testing with k6 or Artillery
- Test scenarios: list events, detail view, map load, filtering
- Target: <200ms p95 for list/detail, <500ms for map
- Database query optimization (EXPLAIN ANALYZE)
- Index optimization based on query patterns
- Response caching (Redis or in-memory)
- API rate limiting implementation
- Frontend bundle size optimization
- Image optimization (if any)

**Acceptance Criteria:**
- [ ] Load tests configured and runnable
- [ ] Baseline metrics documented
- [ ] API responses <200ms p95
- [ ] Map loads <500ms with 1000 events
- [ ] Database indexes optimized
- [ ] Query plan analysis done
- [ ] Caching implemented where beneficial
- [ ] Rate limiting active
- [ ] Frontend bundle <500KB gzipped
- [ ] Performance budget enforced in CI

**Priority:** P2 - Performance
