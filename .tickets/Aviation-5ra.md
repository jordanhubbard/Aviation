---
id: Aviation-5ra
status: closed
deps: []
links: []
created: 2026-01-13T15:15:16.873005-08:00
type: task
priority: 2
mac-task-id: task_aa9bdfbf6a6e446785de7fe9de10bc98
---
# Add integration tests for API and repository

**Epic: Tests - Quality**

Add comprehensive integration tests for API endpoints and database layer.

**Requirements:**
- Test framework: Vitest or Jest with supertest
- Test database: In-memory SQLite for speed
- API endpoint tests (GET /events, GET /events/:id, POST /ingest/run)
- Repository integration tests (upsert, list, get, filtering)
- Authentication tests (valid/invalid tokens)
- Error case tests (404, 400, 500)
- Pagination and filtering tests
- Performance benchmarks (response time thresholds)

**Acceptance Criteria:**
- [ ] Integration test suite configured
- [ ] All API endpoints tested
- [ ] Repository CRUD tested
- [ ] Filter combinations tested
- [ ] Pagination edge cases tested
- [ ] Authentication flows tested
- [ ] Error handling verified
- [ ] Tests run in CI
- [ ] Coverage report >70%

**Priority:** P1 - High (Quality)

## Notes

Added supertest integration tests for events list, event detail, ingest run; covers happy path and 404.
