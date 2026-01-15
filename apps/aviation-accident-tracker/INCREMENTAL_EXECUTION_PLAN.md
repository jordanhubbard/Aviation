# Incremental Execution Plan (Option B)

**Selected Approach:** Incremental extraction + integration
**Status:** Ready to execute
**Updated:** 2026-01-13

---

## Strategy

Extract shared code incrementally and integrate into accident-tracker first, then migrate other apps.

### Why This Approach?

✅ **Lower Risk**
- Validate shared code with fresh codebase first
- Easier integration (no existing code to replace)
- Quick feedback loop

✅ **Faster MVP**
- Accident-tracker gets shared code immediately
- No need to duplicate airport/weather/map code
- Complete MVP faster

✅ **Better Validation**
- Real-world usage before migrating complex apps
- Fix issues in isolated environment
- Proven patterns before flightplanner migration

---

## Execution Phases

### Phase 1: Extract & Integrate Airports (Week 1)
**Goal:** Airport database and search working in shared SDK and accident-tracker

#### Step 1.1: Extract Airports to Shared SDK
**Bead:** [Aviation-o2d] ⭐ P0 - MVP Blocker
**Effort:** 2-3 days

**Tasks:**
1. [ ] Create `packages/shared-sdk/src/aviation/airports.ts`
2. [ ] Port airport search from flightplanner's `airport.py`
   - ICAO/IATA normalization
   - Fuzzy search with scoring
   - Proximity search (haversine distance)
   - Coordinate extraction
3. [ ] Move `airports_cache.json` to `packages/shared-sdk/data/`
4. [ ] Create Python wrapper `packages/shared-sdk/python/aviation/airports.py`
5. [ ] Unit tests (search, lookup, distance)
6. [ ] Documentation with examples
7. [ ] Publish to npm (local for now)

**Acceptance:**
- [ ] TypeScript implementation complete
- [ ] Python wrapper functional
- [ ] All tests passing (>80% coverage)
- [ ] Search performance <10ms
- [ ] Documentation complete

#### Step 1.2: Integrate Airports into Accident-Tracker
**Bead:** [Aviation-a5f] (partial) ⭐ P0 - MVP Blocker
**Effort:** 1 day

**Tasks:**
1. [ ] Add `@aviation/shared-sdk` dependency to backend
2. [ ] Replace stub airport lookup with shared SDK
3. [ ] Use in ingestion adapters (ASN, AVHerald)
4. [ ] Use for geocoding events
5. [ ] Add tests for airport integration
6. [ ] Verify data flows correctly

**Acceptance:**
- [ ] Airport lookup working in accident-tracker
- [ ] Events geocoded with airport data
- [ ] All tests passing
- [ ] No regressions

---

### Phase 2: Extract & Integrate Weather (Week 1-2)
**Goal:** Weather services working in shared SDK and accident-tracker (optional)

#### Step 2.1: Extract Weather Services to Shared SDK
**Bead:** [Aviation-dx3] ⭐ P0 - MVP Blocker
**Effort:** 3-4 days

**Tasks:**
1. [ ] Create `packages/shared-sdk/src/aviation/weather/`
2. [ ] Port OpenWeatherMap client
   - Current weather API
   - Caching (5min TTL)
   - Error handling
3. [ ] Port Open-Meteo client
   - Forecast API
   - Route sampling
4. [ ] Port METAR fetching and parsing
   - AviationWeather.gov API
   - METAR decoder
5. [ ] Port flight category calculations
   - VFR, MVFR, IFR, LIFR
   - Recommendations
6. [ ] Implement weather cache strategy
7. [ ] Configure API keys via keystore
8. [ ] Unit tests (mocked APIs)
9. [ ] Integration tests (optional)
10. [ ] Documentation

**Acceptance:**
- [ ] All weather services ported
- [ ] Caching working (5min TTL)
- [ ] API keys from keystore
- [ ] All tests passing
- [ ] Rate limiting handled

#### Step 2.2: Integrate Weather into Accident-Tracker (Optional)
**Bead:** [Aviation-a5f] (partial) ⭐ P0 - MVP Blocker (optional)
**Effort:** 0.5 day

**Note:** Weather is **optional** for accident-tracker MVP. Can be added later.

**Tasks (if included):**
1. [ ] Add weather to event detail view
2. [ ] Display weather at accident location
3. [ ] Show conditions at time of incident (if available)
4. [ ] Add to API response

**Acceptance:**
- [ ] Weather displayed in UI (if included)
- [ ] No performance impact
- [ ] Tests passing

---

### Phase 3: Extract & Integrate Navigation (Week 2)
**Goal:** Navigation utilities working for distance calculations

#### Step 3.1: Extract Navigation Utilities to Shared SDK
**Bead:** [Aviation-ywm] ⭐ P0 - MVP Blocker
**Effort:** 2 days

**Tasks:**
1. [ ] Create `packages/shared-sdk/src/aviation/navigation/`
2. [ ] Implement distance calculations
   - Haversine (nautical miles, km, mi)
   - Great circle distance
3. [ ] Implement bearing calculations
   - Initial bearing
   - Final bearing
4. [ ] Implement coordinate utilities
   - Normalization
   - Validation
   - Formatting
5. [ ] Implement T/S/D calculations (optional)
6. [ ] Unit tests (100% coverage target)
7. [ ] High precision validation
8. [ ] Documentation

**Acceptance:**
- [ ] All navigation functions implemented
- [ ] Precision validated (<0.1% error)
- [ ] Tests passing (100% coverage)
- [ ] Performance optimized (<1ms per calc)
- [ ] Documentation complete

#### Step 3.2: Integrate Navigation into Accident-Tracker
**Bead:** [Aviation-a5f] (partial) ⭐ P0 - MVP Blocker
**Effort:** 0.5 day

**Tasks:**
1. [ ] Use distance calculations for proximity searches
2. [ ] Calculate distances between events
3. [ ] Display distances in UI
4. [ ] Add to API filters (radius search)

**Acceptance:**
- [ ] Distance calculations working
- [ ] Proximity search functional
- [ ] Tests passing

---

### Phase 4: Extract & Integrate Map Components (Week 2-3)
**Goal:** Map components working in accident-tracker

#### Step 4.1: Extract Map Patterns to UI Framework
**Bead:** [Aviation-r2l] ⭐ P0 - MVP Blocker
**Effort:** 3-4 days

**Tasks:**
1. [ ] Create `packages/ui-framework/src/map/`
2. [ ] Port Leaflet components from flightplanner
   - Base map component
   - Marker component
   - Marker clustering
   - Polyline/route drawing
3. [ ] Create map controls
   - Zoom controls
   - Layer switcher
4. [ ] Event handling (click, hover, drag)
5. [ ] Responsive design
6. [ ] Accessibility (keyboard nav)
7. [ ] TypeScript types
8. [ ] React hooks for map state
9. [ ] Unit tests for utilities
10. [ ] Component tests
11. [ ] Documentation

**Acceptance:**
- [ ] Reusable map components exported
- [ ] All features from flightplanner
- [ ] Performance optimized (60fps)
- [ ] Responsive on mobile
- [ ] Accessibility compliant
- [ ] Tests passing
- [ ] Documentation complete

#### Step 4.2: Integrate Map into Accident-Tracker
**Bead:** [Aviation-58s] ⭐ P0 - MVP Blocker (uses shared components)
**Effort:** 2 days

**Tasks:**
1. [ ] Add `@aviation/ui-framework` dependency to frontend
2. [ ] Implement map using shared components
3. [ ] Display events as clustered pins
4. [ ] Tooltips on hover
5. [ ] Click to open detail modal
6. [ ] Integrate with filter state
7. [ ] Test on mobile

**Acceptance:**
- [ ] Map displays events correctly
- [ ] Clustering works at different zoom levels
- [ ] Tooltips functional
- [ ] Click opens detail modal
- [ ] Responsive on mobile
- [ ] Tests passing

---

### Phase 5: Complete Accident-Tracker MVP (Week 3)
**Goal:** Accident-tracker fully functional with shared SDK

#### Complete All MVP Features
**Beads:** Remaining accident-tracker beads
- [Aviation-gil] ASN adapter ⭐ P0
- [Aviation-82s] AVHerald adapter ⭐ P0
- [Aviation-7r4] Seed data ⭐ P1
- [Aviation-6f2] Event table ⭐ P0
- [Aviation-czw] Filters UI ⭐ P0
- [Aviation-c8f] Detail modal ⭐ P1
- [Aviation-5ra] Integration tests ⭐ P1

**Effort:** 1 week

**Acceptance:**
- [ ] All MVP beads completed
- [ ] Real data flowing from ASN and AVHerald
- [ ] Map, table, filters all working
- [ ] Detail view functional
- [ ] Integration tests passing
- [ ] Deployed to staging

---

### Phase 6: Validate Accident-Tracker (Week 4)
**Goal:** Accident-tracker validated and production-ready

**Tasks:**
1. [ ] Run full test suite
2. [ ] Performance testing
3. [ ] Accessibility audit
4. [ ] Security scan
5. [ ] Load testing
6. [ ] Staging validation
7. [ ] Documentation review
8. [ ] User acceptance testing

**Acceptance:**
- [ ] All tests passing (100%)
- [ ] Performance benchmarks met
- [ ] Accessibility compliant
- [ ] No security vulnerabilities
- [ ] Production ready

---

### Phase 7: Migrate Flightplanner (Week 4-5)
**Goal:** Flightplanner using shared SDK

#### Migrate Flightplanner to Shared SDK
**Bead:** [Aviation-b8m] ⭐ P1 - High Priority
**Effort:** 3-5 days

**Tasks:**
1. [ ] Replace airport code with shared SDK
2. [ ] Replace weather services with shared SDK
3. [ ] Replace navigation utilities
4. [ ] Replace map components
5. [ ] Update API key configuration
6. [ ] Update all tests
7. [ ] Run full test suite
8. [ ] Performance validation
9. [ ] Feature parity check

**Acceptance:**
- [ ] All local code removed
- [ ] Using only shared SDK
- [ ] 100% tests passing
- [ ] Build successful
- [ ] Performance maintained
- [ ] Feature parity confirmed

#### Validate Flightplanner
**Bead:** [Aviation-st5] ⭐ P1 - High Priority
**Effort:** 1-2 days

**Tasks:**
1. [ ] Run full validation suite
2. [ ] Deploy to staging
3. [ ] Smoke tests
4. [ ] Regression testing
5. [ ] Performance benchmarks

**Acceptance:**
- [ ] 100% tests passing
- [ ] Deployed to staging
- [ ] No regressions
- [ ] Performance maintained

---

### Phase 8: Migrate Remaining Apps (Week 5-6)
**Goal:** All apps using shared SDK

**Apps to Migrate:**
1. [Aviation-u90] weather-briefing (1-2 days)
2. [Aviation-64g] flightschool (2 days)
3. [Aviation-cgu] flight-tracker (1-2 days)
4. [Aviation-kmc] foreflight-dashboard (1-2 days)
5. [Aviation-tcy] aviation-missions-app (1 day)

**Effort:** 1-2 weeks

**Acceptance:**
- [ ] All apps migrated
- [ ] All tests passing
- [ ] All builds successful

---

### Phase 9: Full Monorepo Validation (Week 6-7)
**Goal:** 100% CI/CD green across monorepo

#### Run Full Monorepo Validation
**Bead:** [Aviation-8m2] ⭐ P1 - High Priority
**Effort:** 2-3 days

**Tasks:**
1. [ ] Run `make ci-check`
2. [ ] Run `python validate_beads.py`
3. [ ] Run `./scripts/check-all-contrast.sh`
4. [ ] Run `make test` (all apps)
5. [ ] Run `make build` (all apps)
6. [ ] Check all GitHub Actions workflows
7. [ ] Security audit
8. [ ] Documentation review
9. [ ] Performance benchmarks

**Acceptance:**
- [ ] 100% CI/CD green
- [ ] All apps validated
- [ ] No breaking changes
- [ ] Ready for production

---

## Priority Queue (P0 beads in execution order)

### Immediate Start (Week 1)
1. **[Aviation-o2d]** Extract airports to shared SDK (2-3 days)
2. **[Aviation-a5f]** Integrate airports into accident-tracker (1 day)
3. **[Aviation-dx3]** Extract weather to shared SDK (3-4 days)

### Week 2
4. **[Aviation-ywm]** Extract navigation to shared SDK (2 days)
5. **[Aviation-a5f]** Integrate navigation into accident-tracker (0.5 day)
6. **[Aviation-r2l]** Extract map components to UI framework (3-4 days)

### Week 2-3
7. **[Aviation-58s]** Implement map in accident-tracker (2 days)
8. **[Aviation-6f2]** Implement event table (2 days)
9. **[Aviation-czw]** Implement filters UI (2 days)
10. **[Aviation-gil]** Implement ASN adapter (2-3 days)
11. **[Aviation-82s]** Implement AVHerald adapter (2 days)

### Week 3-4
12. Complete remaining accident-tracker beads
13. Full accident-tracker validation

### Week 4-5
14. **[Aviation-b8m]** Migrate flightplanner (3-5 days)
15. **[Aviation-st5]** Validate flightplanner (1-2 days)

### Week 5-6
16. Migrate remaining 5 apps

### Week 6-7
17. **[Aviation-8m2]** Full monorepo validation (2-3 days)

---

## Success Metrics

### Week 1
- [ ] Airports extraction complete
- [ ] Airports integrated in accident-tracker
- [ ] Weather extraction complete

### Week 2
- [ ] Navigation extraction complete
- [ ] Map components extraction complete
- [ ] Accident-tracker using all shared code

### Week 3
- [ ] Accident-tracker MVP feature complete
- [ ] Real data flowing
- [ ] All UI components working

### Week 4
- [ ] Accident-tracker validated and production-ready
- [ ] Flightplanner migration in progress

### Week 5
- [ ] Flightplanner migrated and validated
- [ ] Remaining apps migration in progress

### Week 6-7
- [ ] All apps migrated
- [ ] 100% CI/CD green
- [ ] Ready for production

---

## Risk Mitigation

### Risks
1. **Shared SDK issues** discovered during integration
2. **Performance regressions** from abstraction
3. **Breaking changes** during extraction
4. **Timeline slippage** on complex migrations

### Mitigation
1. ✅ **Validate early** with accident-tracker
2. ✅ **Performance benchmarks** at each phase
3. ✅ **Feature parity checks** for each migration
4. ✅ **Buffer time** in estimates (3-4 days → 5 days)
5. ✅ **Rollback plan** for each app

---

## Communication

### Daily Standups
- Progress on current bead
- Blockers
- Next bead in queue

### Weekly Reviews
- Week's accomplishments
- Next week's plan
- Risks and issues

### Milestone Demos
- End of Phase 1: Airports working
- End of Phase 5: Accident-tracker MVP
- End of Phase 7: Flightplanner migrated
- End of Phase 9: All apps validated

---

## Next Actions

### Immediate (This Week)
1. ✅ Review and approve this plan
2. ⏳ Start **[Aviation-o2d]** - Extract airports
3. ⏳ Parallel: Continue **[Aviation-7r4]** - Seed data (independent)

### This Month
- Complete Phases 1-5 (Accident-tracker MVP with shared SDK)
- Begin Phase 7 (Flightplanner migration)

### Next Month
- Complete Phases 7-9 (All apps migrated and validated)
- Production deployment

---

**Status:** Ready to execute ✅
**Approved:** Pending
**Start Date:** TBD
**Target Completion:** 6-7 weeks from start
