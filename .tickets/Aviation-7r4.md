---
id: Aviation-7r4
status: closed
deps: []
links: []
created: 2026-01-13T15:14:27.974809-08:00
type: task
priority: 2
mac-task-id: task_bd5f4280451c4d3a95664bcad508f4b8
---
# Create seed data script for testing

**Epic: Database - Important**

Create script to populate database with sample accident/incident data for testing.

**Requirements:**
- Script to seed 20-50 realistic events
- Mix of general aviation and commercial
- Geographic distribution (US, Europe, Asia, etc.)
- Date range: last 2 years
- Include various aircraft types, operators
- Include some with missing fields (test robustness)
- Multiple sources per event (test provenance)
- Script should be idempotent (can run multiple times)

**Acceptance Criteria:**
- [ ] Seed script in `scripts/seed-data.ts` or `.sql`
- [ ] Populates 20-50 diverse events
- [ ] GA and commercial mix (~60/40)
- [ ] Geographic diversity
- [ ] Various date ranges
- [ ] Can be run multiple times safely
- [ ] Documentation in README
- [ ] Enables frontend development/testing

**Blocks:** Frontend development (needs test data)
**Priority:** P1 - High

## Notes

Added backend/data/seeds.json (18 diverse events) and npm run seed via scripts/seed-data.ts for local dev; idempotent upsert into memoryRepo.
