---
id: Aviation-czw
status: closed
deps: []
links: []
created: 2026-01-13T15:14:52.126619-08:00
type: task
priority: 2
mac-task-id: task_820076a0c6474d789a05da7ec02c1d29
---
# Implement frontend filters UI

**Epic: Frontend - Critical**

Build filter controls for searching and filtering events.

**Requirements:**
- Date range picker (from/to)
- Category dropdown (General Aviation / Commercial / All)
- Airport/ICAO input with autocomplete
- Country/region selector
- Text search input (registration, operator, summary)
- Clear filters button
- Filter state management (URL params or state)
- Apply filters to API calls
- Show active filter count badge

**Acceptance Criteria:**
- [ ] Date range picker (MUI DateRangePicker)
- [ ] Category dropdown with icons
- [ ] Airport autocomplete (if airport DB available)
- [ ] Country/region selector
- [ ] Text search with debounce
- [ ] Clear all filters button
- [ ] URL params reflect filter state (shareable)
- [ ] Active filter count visible
- [ ] Filters update map and table
- [ ] Mobile responsive (collapsible)
- [ ] Accessible (keyboard, labels)

**Depends on:** Event table, Map
**Priority:** P0 - MVP blocker

## Notes

Filters: search/category/airport + country/region + date range; active filter badge; API-backed airport options.
