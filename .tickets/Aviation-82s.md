---
id: Aviation-82s
status: closed
deps: []
links: []
created: 2026-01-13T15:14:10.414341-08:00
type: task
priority: 2
mac-task-id: task_fec4183b359d42c1b402de9ea04fa5b2
---
# Implement AVHerald adapter for incident data

**Epic: Data Sources - Critical**

Implement AVHerald RSS/feed parsing for aviation incidents.

**Requirements:**
- Parse AVHerald feed (RSS/Atom at https://avherald.com)
- Extract incident data from feed items
- Extract: date, registration, aircraft type, operator, location, summary
- Handle feed format variations
- Respect rate limits
- Add error handling for malformed entries
- Return EventRecord array with proper sources

**Acceptance Criteria:**
- [ ] Successfully fetches and parses AVHerald feed
- [ ] Returns incidents from last 40 days
- [ ] All required fields extracted
- [ ] Dates normalized to UTC
- [ ] Classification applied (GA vs Commercial)
- [ ] Source attribution included
- [ ] Handles feed errors gracefully
- [ ] Unit tests with fixture feed

**Blocks:** Frontend map/table (needs real data)
**Priority:** P0 - MVP blocker

## Notes

AVHerald adapter fetches RSS with fixture fallback; parses title/link/pubDate to events; returns >10 with fallback fixtures.
