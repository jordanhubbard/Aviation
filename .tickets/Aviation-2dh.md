---
id: Aviation-2dh
status: closed
deps: []
links: []
created: 2026-01-13T15:15:08.869543-08:00
type: task
priority: 2
mac-task-id: task_d3ff72c8423b46f88731fccbdd1e5a1c
---
# Implement fuzzy deduplication logic

**Epic: Data Sources - Enhancement**

Add fuzzy matching to catch duplicates beyond exact (date_z, registration) match.

**Requirements:**
- Fuzzy match on: date_z ±1 day, country, aircraft_type
- Scoring system for match confidence
- Merge logic that preserves all sources
- Field conflict resolution (prefer more complete data)
- Manual review flag for low-confidence matches
- Logging of fuzzy matches for monitoring
- Threshold tuning based on test cases

**Acceptance Criteria:**
- [ ] Fuzzy matching implemented
- [ ] Catches duplicates with date variations
- [ ] Matches on country + type when reg differs
- [ ] Confidence scoring (0-100)
- [ ] Merge preserves all sources
- [ ] Manual review flag for <80% confidence
- [ ] Unit tests with edge cases
- [ ] Documentation of matching rules

**Depends on:** ASN adapter, AVHerald adapter
**Priority:** P2 - Enhancement

## Notes

Added fuzzyDedup with similarity scoring (date±1d, registration, country, type), merge preserves sources; tests added.
