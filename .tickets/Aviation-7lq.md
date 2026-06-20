---
id: Aviation-7lq
status: closed
deps: []
links: []
created: 2026-01-14T10:06:07.112868-08:00
type: feature
priority: 2
mac-task-id: task_fb285a1a26bd406eaf65bd3c3ea17067
---
# Add NOTAM integration to weather-briefing

Integrate FAA NOTAM (Notice to Airmen) data into weather briefing service.

**Data Source:**
- FAA NOTAM Search API: https://notams.aim.faa.gov/notamSearch/
- Alternative: Aviation Weather Center NOTAM API

**Requirements:**
1. **NOTAM Fetching:**
   - Fetch NOTAMs by ICAO code
   - Fetch NOTAMs by radius around coordinates
   - Filter by effective dates
   - Cache results (15-minute TTL)

2. **NOTAM Parsing:**
   - Parse NOTAM format
   - Extract key information (type, location, effective dates)
   - Categorize by severity/type
   - Highlight relevant NOTAMs for route

3. **Integration:**
   - Add to weather briefing output
   - Display in UI with severity indicators
   - Filter out expired NOTAMs
   - Show route-specific NOTAMs

**Acceptance Criteria:**
- [ ] NOTAM API integration working
- [ ] Parsing and categorization complete
- [ ] Integrated into briefing service
- [ ] UI displays NOTAMs
- [ ] Tests added
- [ ] Documentation updated

**Estimated Effort:** 4-5 days
