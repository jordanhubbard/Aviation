---
id: Aviation-c8f
status: closed
deps: []
links: []
created: 2026-01-13T15:15:00.08525-08:00
type: task
priority: 2
mac-task-id: task_e80089a7769a4087abb279f97c0a9339
---
# Implement frontend detail modal/view

**Epic: Frontend - Important**

Build detailed view/modal for individual accident/incident.

**Requirements:**
- MUI Dialog/Modal component
- Display all event fields (date, registration, operator, aircraft type, location, narrative)
- Show fatalities/injuries prominently
- Display all sources with outbound links
- Status badge (preliminary/final)
- Category badge (GA/Commercial)
- Map snippet showing location
- Close button and ESC key
- Deep link support (direct URL to event)
- Print-friendly layout

**Acceptance Criteria:**
- [ ] Modal displays all event details
- [ ] Narrative formatted properly
- [ ] Sources listed with clickable links
- [ ] Status and category badges
- [ ] Location map snippet (optional)
- [ ] ESC key closes modal
- [ ] Direct URL works (/events/:id)
- [ ] Mobile responsive
- [ ] Accessible (focus trap, ARIA)
- [ ] Print stylesheet

**Depends on:** Event table, Map
**Priority:** P1 - High

## Notes

normalize closed_at precision

---

Detail modal: shows fields/status/category badges, sources, location info, ESC/click close, opens from map/table.
