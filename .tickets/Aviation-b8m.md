---
id: Aviation-b8m
status: closed
deps: []
links: []
created: 2026-01-13T15:22:34.940179-08:00
type: task
priority: 2
mac-task-id: task_1ebcdf3ae0904e1f91ccecf2fc6ca15d
---
# Migrate flightplanner to use shared aviation SDK

**Epic Child: Aviation-q0h - Migrate Apps to Shared SDK**

Migrate flightplanner app to use shared SDK for airports, weather, and navigation.

**Current Code to Replace:**
- `backend/app/models/airport.py` → `@aviation/shared-sdk/aviation/airports`
- `backend/app/services/openweathermap.py` → `@aviation/shared-sdk/aviation/weather`
- `backend/app/services/open_meteo.py` → `@aviation/shared-sdk/aviation/weather`
- `backend/app/services/metar.py` → `@aviation/shared-sdk/aviation/weather`
- Navigation functions → `@aviation/shared-sdk/aviation/navigation`
- `frontend/src/components/LocalMap.tsx` → `@aviation/ui-framework/map`

**Migration Steps:**
1. [ ] Update package.json/requirements.txt dependencies
2. [ ] Replace airport imports with shared SDK
3. [ ] Replace weather service imports
4. [ ] Replace navigation utilities
5. [ ] Replace map components
6. [ ] Update API key configuration
7. [ ] Update tests to use shared SDK
8. [ ] Run full test suite
9. [ ] Verify all features working
10. [ ] Update documentation

**Testing Requirements:**
- [ ] All existing tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Performance benchmarks met
- [ ] No regressions

**Feature Parity Checklist:**
- [ ] Airport search works identically
- [ ] Weather data fetching unchanged
- [ ] Route planning produces same results
- [ ] Map rendering identical
- [ ] All filters/features functional

**Acceptance Criteria:**
- [ ] All local code removed
- [ ] Using only shared SDK
- [ ] 100% tests passing
- [ ] Build successful
- [ ] Performance maintained
- [ ] Documentation updated

**Estimated Effort:** 3-5 days
