---
id: Aviation-64g
status: closed
deps: []
links: []
created: 2026-01-13T15:22:53.203583-08:00
type: task
priority: 2
mac-task-id: task_07840b1c8ccc46fd85428a7ffbda99bd
---
# Migrate flightschool to use shared SDK (Google Calendar)

**Epic Child: Aviation-q0h - Migrate Apps to Shared SDK**

Migrate flightschool to use shared Google Calendar integration.

**Current Code to Replace:**
- `app/calendar_service.py` → `@aviation/shared-sdk/integrations/google/calendar`

**Migration Steps:**
1. [ ] Add shared-sdk dependency
2. [ ] Replace GoogleCalendarService with shared implementation
3. [ ] Update OAuth flow to use shared SDK
4. [ ] Migrate credential storage to keystore
5. [ ] Update booking routes to use shared SDK
6. [ ] Run full test suite
7. [ ] Verify calendar sync working
8. [ ] Update documentation

**Testing Requirements:**
- [ ] OAuth flow works
- [ ] Calendar events created correctly
- [ ] Event updates work
- [ ] Booking conflicts prevented
- [ ] All existing tests pass

**Feature Parity Checklist:**
- [ ] OAuth authorization unchanged
- [ ] Event creation identical
- [ ] Timezone handling preserved
- [ ] Error handling maintained

**Acceptance Criteria:**
- [ ] Local calendar service removed
- [ ] Using shared SDK only
- [ ] 100% tests passing
- [ ] Calendar sync functional
- [ ] Documentation updated

**Estimated Effort:** 2 days
