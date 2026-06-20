---
id: Aviation-6pc.4
status: closed
deps: []
links: []
created: 2026-01-15T00:05:36.460835-08:00
type: task
priority: 1
parent: Aviation-6pc
mac-task-id: task_c41e2e1a57bd4dc280f12beea6d904c2
---
# Create pane components for all existing apps

Extract/create embeddable pane components for each of the 7 aviation applications.

**Apps to create panes for:**
1. [ ] aviation-accident-tracker
2. [ ] aviation-missions-app  
3. [ ] flight-tracker
4. [ ] flightplanner
5. [ ] flightschool
6. [ ] foreflight-dashboard
7. [ ] weather-briefing

**Per-app tasks:**
- Create src/ui/pane.tsx component
- Export pane from package.json
- Handle API communication within pane
- Test pane in isolation
- Document pane API

**Deliverables:**
- Pane component for each app (7 total)
- Updated package.json exports
- Documentation for each pane
