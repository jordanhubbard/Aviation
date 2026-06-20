---
id: Aviation-5o5
status: closed
deps: []
links: []
created: 2026-01-13T15:22:12.568287-08:00
type: task
priority: 2
mac-task-id: task_18eead6a478f422f84f5ac7d7fbfeea1
---
# Extract Google Calendar integration to @aviation/shared-sdk

**Epic Child: Aviation-sv9 - Shared Aviation Data Services**

Extract Google Calendar OAuth and API integration from flightschool into shared SDK.

**Current Implementation:**
- Location: `apps/flightschool/app/calendar_service.py`
- Features:
  - OAuth2 flow for Google Calendar
  - Calendar event creation
  - Event updates and deletion
  - Calendar sync
  - Credential management

**External Service:**
- Google Calendar API
- Requires: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

**Target Location:**
- `packages/shared-sdk/src/integrations/google/`
  - `calendar.ts` - Calendar API client
  - `auth.ts` - OAuth2 flow
  - `types.ts` - TypeScript types

**Requirements:**
- [ ] OAuth2 authorization flow
- [ ] Token storage and refresh
- [ ] Create calendar events
- [ ] Update/delete events
- [ ] List events with filtering
- [ ] Recurring event support
- [ ] Timezone handling
- [ ] Error handling
- [ ] Rate limiting
- [ ] TypeScript implementation
- [ ] Python wrapper
- [ ] Unit tests (mocked API)
- [ ] Integration tests (optional)

**Security:**
- Store credentials in keystore
- Secure token refresh
- Scope validation

**Acceptance Criteria:**
- [ ] OAuth flow working
- [ ] All calendar operations functional
- [ ] Token refresh automatic
- [ ] Rate limiting handled
- [ ] Tests passing
- [ ] Documentation complete
- [ ] Example code provided

**Blocks:** flightschool migration
