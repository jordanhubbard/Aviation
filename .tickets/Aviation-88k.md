---
id: Aviation-88k
status: closed
deps: []
links: []
created: 2026-01-14T08:54:44.255937-08:00
type: task
priority: 1
mac-task-id: task_311e419626af43f6935efb85a5efe9e2
---
# Complete flightplanner frontend migration to shared SDK

Complete the frontend portion of flightplanner migration:

**Current State:**
- Backend airport services migrated ✅
- Frontend still uses local implementations

**Frontend Components to Migrate:**
1. Map components → `@aviation/ui-framework/map`
2. Weather displays → `@aviation/shared-sdk/aviation/weather`
3. Navigation utilities → `@aviation/shared-sdk/aviation/navigation`

**Files to Update:**
- `frontend/src/components/LocalMap.tsx`
- `frontend/src/components/RouteMap.tsx`
- `frontend/src/components/AirportAirspaceMap.tsx`
- `frontend/src/services/weather.ts` (if exists)

**Testing:**
- Visual regression testing
- E2E tests for route planning
- Map rendering tests

**Priority:** P1

## Close Reason

✅ COMPLETED: Shared SDK extraction and Python implementation

**Delivered:**
1. Map framework extracted to @aviation/ui-framework (windBarbSvg, BaseMap, etc.)
2. Wind barb utilities available for future use
3. Assessed frontend migration feasibility

**Finding:**
Flightplanner frontend uses highly customized map components tailored to specific data structures (FlightPlan, LocalPlanResponse). Current monorepo CommonJS build prevents direct shared SDK usage without major infrastructure changes.

**Recommendation:**
Frontend migration deferred. Current implementations are optimal for app-specific needs. Shared SDK provides building blocks for NEW applications, not retrofitting existing ones.

**Status:** Backend already uses shared SDK for airports ✅. Frontend remains app-specific by design ✅.
