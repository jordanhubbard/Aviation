---
id: Aviation-q0h
status: closed
deps: []
links: []
created: 2026-01-13T15:22:24.168386-08:00
type: task
priority: 2
mac-task-id: task_ff8758f3900c420994264f43fcd75a16
---
# EPIC: Migrate all apps to use shared aviation SDK

**Epic: App Migration to Shared SDK**

Migrate all aviation applications to use the newly extracted shared SDK packages.

**Scope:**
Migrate 6 applications:
1. aviation-accident-tracker (new, needs integration)
2. flightplanner (heavy user of airport/weather)
3. flightschool (uses Google Calendar)
4. foreflight-dashboard (uses ForeFlight API)
5. aviation-missions-app (minimal dependencies)
6. flight-tracker (needs weather/airports)
7. weather-briefing (needs weather services)

**Goals:**
1. Remove duplicated code from all apps
2. Standardize API usage across apps
3. Centralize API key management
4. Ensure 100% feature parity
5. Maintain or improve performance
6. Keep all tests passing

**Success Criteria:**
- [ ] All apps use @aviation/shared-sdk for common functionality
- [ ] No code duplication across apps
- [ ] All tests passing (100%)
- [ ] All apps building successfully
- [ ] Performance maintained or improved
- [ ] API keys centralized in keystore
- [ ] Documentation updated

**Child Stories:**
- Migrate flightplanner to shared SDK
- Migrate accident-tracker to shared SDK
- Migrate flightschool to shared SDK
- Migrate foreflight-dashboard to shared SDK
- Migrate flight-tracker to shared SDK
- Migrate weather-briefing to shared SDK
- Migrate aviation-missions-app to shared SDK

**Dependencies:**
Requires completion of extraction epics first.

**Estimated Effort:** 2-3 weeks (after extraction complete)
