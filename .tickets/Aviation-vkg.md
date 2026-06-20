---
id: Aviation-vkg
status: closed
deps: []
links: []
created: 2026-01-13T15:15:41.127747-08:00
type: task
priority: 2
mac-task-id: task_dce1e4a342314360975065fb62803cb9
---
# Add frontend component and E2E tests

**Epic: Tests - Quality**

Implement frontend testing with component tests and E2E happy paths.

**Requirements:**
- Component tests with React Testing Library
- Test map component (render, clustering, tooltips)
- Test table component (render, sorting, pagination)
- Test filter component (all filter types)
- Test detail modal (display, navigation)
- E2E tests with Playwright or Cypress
- E2E: Load page → filter → see results → open detail
- E2E: Map interaction → click pin → see detail
- Accessibility tests (axe-core)

**Acceptance Criteria:**
- [ ] Component tests for all major components
- [ ] Test coverage >70% for frontend
- [ ] E2E happy path: filter and view
- [ ] E2E happy path: map interaction
- [ ] Accessibility tests passing
- [ ] Tests run in CI
- [ ] Screenshot/visual regression tests
- [ ] Mobile viewport tests

**Depends on:** Map, Table, Filters, Detail modal
**Priority:** P2 - Quality
