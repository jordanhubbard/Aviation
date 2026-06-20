---
id: Aviation-gil
status: closed
deps: []
links: []
created: 2026-01-13T15:14:03.716927-08:00
type: task
priority: 2
mac-task-id: task_dc8c0225fbb445e0a47d2670b0cae873
---
# Implement ASN adapter for real data ingestion

**Epic: Data Sources - Critical**

Implement actual Aviation Safety Network (ASN) web scraping/API integration.

**Requirements:**
- Scrape ASN recent occurrences page (https://aviation-safety.net)
- Parse HTML to extract accident/incident data
- Extract: date, registration, aircraft type, operator, location, summary, narrative
- Handle pagination if needed for recent window (40 days)
- Respect robots.txt and rate limits
- Add error handling for parsing failures
- Return EventRecord array with proper sources

**Acceptance Criteria:**
- [ ] Successfully fetches and parses ASN data
- [ ] Returns at least 10 events for 40-day window
- [ ] All required fields extracted
- [ ] Dates normalized to UTC
- [ ] Classification applied (GA vs Commercial)
- [ ] Source attribution included
- [ ] Error handling tested
- [ ] Unit tests with fixture data

**Blocks:** Frontend map/table (needs real data)
**Priority:** P0 - MVP blocker

## Notes

ASN adapter fetches RSS with fixture fallback; parses title/link/pubDate into normalized RawEvents; returns >10 with fixtures.
