---
id: Aviation-7p1
status: closed
deps: []
links: []
created: 2026-01-14T10:06:17.755906-08:00
type: feature
priority: 2
mac-task-id: task_087e53a819eb42c5942705effe5ced3b
---
# Add weight and balance calculator to flightplanner

Add aircraft weight and balance calculator to flight planning tool.

**Features:**
1. **Aircraft Profiles:**
   - Store aircraft-specific data (empty weight, CG, moment arms)
   - Support multiple aircraft types
   - Save custom aircraft configurations
   - Import from common formats

2. **Weight Calculation:**
   - Pilot + passengers weights
   - Fuel weight (gallons to pounds conversion)
   - Baggage/cargo weights
   - Station-specific loading
   - Real-time total weight calculation

3. **Balance Calculation:**
   - Calculate CG position
   - Show CG envelope graph
   - Warn if out of limits
   - Suggest load adjustments
   - Show moment calculations

4. **Integration:**
   - Use fuel calculations from shared SDK
   - Link to route planning
   - Save W&B with flight plans
   - Print/export W&B sheet

**Acceptance Criteria:**
- [ ] Aircraft profile management
- [ ] Weight calculations accurate
- [ ] CG calculations correct
- [ ] Visual CG envelope display
- [ ] Out-of-limits warnings
- [ ] Integration with route planner
- [ ] Tests for all calculations
- [ ] Documentation complete

**Estimated Effort:** 5-7 days
