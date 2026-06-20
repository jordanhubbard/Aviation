---
id: Aviation-ywm
status: closed
deps: []
links: []
created: 2026-01-13T15:21:51.383142-08:00
type: task
priority: 0
mac-task-id: task_53427cc57bfb4d2a9cebc62c83039fd3
---
# Extract navigation utilities to @aviation/shared-sdk

**Epic Child: Aviation-sv9 - Shared Aviation Data Services**

Extract navigation calculations and utilities from flightplanner into shared SDK.

**Current Implementation:**
- Location: Various files in `apps/flightplanner/backend/`
- Features:
  - Haversine distance calculation (nautical miles)
  - Great circle route calculation
  - Bearing/heading calculations
  - Coordinate normalization and validation
  - Fuel range calculations
  - Time/distance/speed calculations

**Target Location:**
- `packages/shared-sdk/src/aviation/navigation/`
  - `distance.ts` - Distance calculations
  - `bearing.ts` - Heading/bearing calculations
  - `coordinates.ts` - Coordinate utilities
  - `fuel.ts` - Fuel range and consumption
  - `time-speed-distance.ts` - T/S/D calculations

**Requirements:**
- [ ] Haversine distance (NM, km, mi)
- [ ] Great circle route generation
- [ ] Initial and final bearing calculations
- [ ] Midpoint calculation
- [ ] Destination point given distance and bearing
- [ ] Coordinate validation and normalization
- [ ] Fuel range calculations
- [ ] Time/speed/distance formulas
- [ ] Wind correction angles
- [ ] Ground speed calculations
- [ ] Unit tests for all calculations
- [ ] High precision (< 0.1% error)

**Aviation Constants:**
- Earth radius in nautical miles (3440.065)
- Standard atmosphere calculations
- Fuel density (Avgas, Jet-A)

**Acceptance Criteria:**
- [ ] All navigation functions implemented
- [ ] Precision validated against known values
- [ ] Unit tests achieving 100% coverage
- [ ] TypeScript types for all parameters
- [ ] Python wrapper for Python apps
- [ ] Documentation with aviation examples
- [ ] Performance optimized (< 1ms per calc)

**Blocks:** flightplanner route planning, accident-tracker distance calculations
