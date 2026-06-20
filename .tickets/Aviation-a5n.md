---
id: Aviation-a5n
status: closed
deps: []
links: []
created: 2026-01-14T23:49:34.886612-08:00
type: task
priority: 1
mac-task-id: task_429b71eb760a4a298f0d77978e401fef
---
# Fix accident-tracker TypeScript build errors

Fix all 27+ TypeScript compilation errors in accident-tracker backend:

**Repository API Issues:**
- Add missing getEventDetail() method
- Add missing getStatistics() method  
- Fix listEvents() return type to match {events, total}

**Import Errors:**
- Remove/fix '../data/airports.json' import
- Fix AirportDirectory import from shared-sdk
- Fix '../db' module path in middleware/auth.ts
- Add missing test dependencies (supertest, @types/jest)

**Type Mismatches:**
- Add 'region' field to Airport type or fix usage
- Fix test file type definitions
- Fix GraphQL resolver type expectations

**Goal:** Backend builds successfully with 0 errors

## Notes

Duplicate of Aviation-n2b - all work already completed. Backend and frontend both build successfully with 0 errors. All 27+ TypeScript errors fixed.
