---
id: Aviation-58s
status: closed
deps: []
links: []
created: 2026-01-13T15:14:36.159462-08:00
type: task
priority: 2
mac-task-id: task_2488211073754997ad081e41f40dad05
---
# Implement frontend map with Leaflet/MapLibre

**Epic: Frontend - Critical**

Build interactive map component showing accident/incident locations.

**Requirements:**
- Leaflet or MapLibre for map rendering
- Display events as clustered pins
- Cluster markers at zoom levels (use Leaflet.markercluster)
- Tooltip on hover: date, registration, operator, summary
- Click pin to open detail modal
- Filter integration (show only filtered events)
- Responsive design (mobile-friendly)
- Handle events without coordinates gracefully

**Acceptance Criteria:**
- [ ] Map renders with base tiles (OpenStreetMap)
- [ ] Events displayed as pins
- [ ] Clustering works at different zoom levels
- [ ] Tooltips show on hover
- [ ] Click opens detail modal
- [ ] Integrates with filter state
- [ ] Map updates when filters change
- [ ] Responsive on mobile
- [ ] Loading states handled
- [ ] Empty state (no events)

**Depends on:** Seed data, Airport lookup
**Priority:** P0 - MVP blocker

## Notes

Frontend map uses Leaflet with clustering, tooltips, detail modal; filters (search/category/airport) wired to API; pagination and empty/loading states added.
