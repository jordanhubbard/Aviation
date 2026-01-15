# New Beads Created for Aviation Accident Tracker

Created: 2026-01-13

## Summary

Created **15 new beads** to complete the missing work identified in COMPLETION_STATUS.md.

Total: **24 beads** (9 original closed + 15 new open)

---

## MVP Blockers (P0) - 7 beads

These are **critical** to have a working MVP:

### Data Sources
1. **[Aviation-gil]** Implement ASN adapter for real data ingestion
   - Scrape Aviation Safety Network
   - Parse HTML/JSON for accident data
   - **Blocks:** Frontend (needs real data)

2. **[Aviation-82s]** Implement AVHerald adapter for incident data
   - Parse AVHerald RSS/feed
   - Extract incident data
   - **Blocks:** Frontend (needs real data)

### Geo
3. **[Aviation-6j7]** Implement airport lookup service (ICAO/IATA geo)
   - Load airport database
   - Lookup ICAO/IATA → coordinates
   - **Blocks:** Map visualization

### Frontend
4. **[Aviation-58s]** Implement frontend map with Leaflet/MapLibre
   - Interactive map with clustered pins
   - Tooltips and click-to-detail
   - **Blocks:** Core UI experience

5. **[Aviation-6f2]** Implement frontend event list/table component
   - Table with all event columns
   - Sorting, pagination
   - **Blocks:** Core UI experience

6. **[Aviation-czw]** Implement frontend filters UI
   - Date range, category, airport, country, text search
   - URL params for sharing
   - **Blocks:** Core UI experience

---

## High Priority (P1) - 3 beads

Important for MVP quality and usability:

7. **[Aviation-7r4]** Create seed data script for testing
   - Populate 20-50 diverse events
   - Enable frontend development
   - **Label:** tooling

8. **[Aviation-c8f]** Implement frontend detail modal/view
   - Full event details with sources
   - Deep linking
   - **Label:** frontend

9. **[Aviation-5ra]** Add integration tests for API and repository
   - Test all endpoints and filters
   - Coverage >70%
   - **Label:** quality, tests

---

## Medium Priority (P2) - 6 beads

Enhancements and production readiness:

### Data Sources
10. **[Aviation-2dh]** Implement fuzzy deduplication logic
    - Date ±1 day, country, type matching
    - Confidence scoring
    - **Label:** enhancement

11. **[Aviation-jme]** Implement scheduled/automated ingestion
    - Cron scheduler (every 6 hours)
    - Automated data refresh
    - **Label:** production

### Tests
12. **[Aviation-vkg]** Add frontend component and E2E tests
    - React Testing Library tests
    - Playwright/Cypress E2E
    - **Label:** quality

13. **[Aviation-ohi]** Performance testing and optimization
    - Load testing (k6/Artillery)
    - Database optimization
    - **Label:** performance

### Documentation
14. **[Aviation-uqf]** Add OpenAPI/Swagger documentation
    - OpenAPI 3.0 spec
    - Swagger UI at /docs
    - **Label:** documentation

15. **[Aviation-8e7]** Write operational documentation and runbook
    - Deployment guide
    - Troubleshooting
    - **Label:** operations

---

## Dependency Graph

```
MVP Critical Path:
  1. ASN Adapter (Aviation-gil) ─┐
  2. AVHerald Adapter (Aviation-82s) ─┤
  3. Seed Data (Aviation-7r4) ─────────┼─→ Frontend Map (Aviation-58s) ─┐
  4. Airport Lookup (Aviation-6j7) ────┘                                  ├─→ MVP ✅
                                                                          │
                                        Frontend Table (Aviation-6f2) ───┤
                                        Frontend Filters (Aviation-czw) ─┤
                                        Detail Modal (Aviation-c8f) ─────┘

Post-MVP Enhancements:
  - Fuzzy Dedupe (Aviation-2dh) [depends on adapters]
  - Scheduled Ingestion (Aviation-jme) [depends on adapters]
  - Integration Tests (Aviation-5ra)
  - Frontend Tests (Aviation-vkg) [depends on frontend components]
  - Performance Tests (Aviation-ohi)
  - OpenAPI Docs (Aviation-uqf)
  - Ops Docs (Aviation-8e7)
```

---

## Work Estimates

Based on complexity:

| Priority | Count | Est. Days | Description |
|----------|-------|-----------|-------------|
| P0 (MVP Blockers) | 7 | 10-14 days | Critical path to working product |
| P1 (High) | 3 | 3-5 days | Quality and testing |
| P2 (Medium) | 5 | 5-7 days | Enhancements and ops |
| **TOTAL** | **15** | **18-26 days** | **~3-5 weeks for one dev** |

---

## Next Steps

### Immediate (This Week)
1. Start **Aviation-gil** (ASN adapter) - Get real data flowing
2. Start **Aviation-7r4** (Seed data) - Enable frontend work
3. Parallel: **Aviation-6j7** (Airport lookup) - Geo foundation

### Week 2
4. **Aviation-82s** (AVHerald adapter) - Second data source
5. **Aviation-58s** (Frontend map) - Start UI with seed data
6. **Aviation-6f2** (Frontend table) - List view

### Week 3
7. **Aviation-czw** (Frontend filters) - Complete filtering
8. **Aviation-c8f** (Detail modal) - Complete UI
9. **Aviation-5ra** (Integration tests) - Quality gate

### Week 4+
10. Polish and optimization
11. Documentation
12. Production deployment

---

## Success Criteria

**MVP is complete when:**
- ✅ Real data flows from ASN and AVHerald
- ✅ Map displays clustered events
- ✅ Table shows sortable/filterable list
- ✅ Filters work (date, category, airport, search)
- ✅ Detail view shows full event info
- ✅ Integration tests passing
- ✅ Deployed and accessible

**Total Implementation:** ~45% → 100%
