---
id: Aviation-6f2
status: closed
deps: []
links: []
created: 2026-01-13T15:14:44.147649-08:00
type: task
priority: 2
mac-task-id: task_feecf9106e75498cb363dfbf15927109
---
# Implement frontend event list/table component

**Epic: Frontend - Critical**

Build table component to display accident/incident events.

**Requirements:**
- MUI DataGrid or custom table
- Columns: date (Z), registration, operator, aircraft type, airport/region, category, fatalities/injuries, sources
- Sort by date DESC (default)
- Click row to open detail modal
- Pagination (integrate with API limit/offset)
- Loading states and skeletons
- Empty state when no results
- Responsive (mobile: card layout)
- Category badge styling (color-coded)

**Acceptance Criteria:**
- [ ] Table displays all required columns
- [ ] Sorted by date DESC by default
- [ ] Click opens detail modal
- [ ] Pagination works (50 per page)
- [ ] Loading skeleton during fetch
- [ ] Empty state message
- [ ] Mobile responsive (cards)
- [ ] Category badges color-coded
- [ ] Source count badge
- [ ] Accessible (keyboard nav, screen reader)

**Depends on:** Seed data
**Priority:** P0 - MVP blocker

## Notes

Table shows events with badges; pagination/empty/loading states; click opens detail modal; filters drive API calls.
