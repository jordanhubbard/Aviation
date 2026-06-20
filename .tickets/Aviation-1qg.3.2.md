---
id: Aviation-1qg.3.2
status: closed
deps: []
links: []
created: 2026-01-15T11:32:02.191133-08:00
type: bug
priority: 0
parent: Aviation-1qg.3
mac-task-id: task_5f0a109334044c289ba3586d6e129c40
---
# BLOCKER: TypeScript module resolution fails for shared-sdk re-exports

TypeScript successfully resolves @aviation/shared-sdk module to the correct .d.ts file, but then claims re-exported members don't exist.

## Issue
TypeScript fails with:
```
error TS2305: Module '@aviation/shared-sdk' has no exported member 'fetchMetarRaw'
```

## ROOT CAUSE IDENTIFIED ✅
When shared-sdk tsconfig was changed from `module: esnext` to `module: commonjs`, TypeScript's module resolution behavior changed. It could no longer resolve `'./aviation/weather'` without an explicit `'index'` in the path.

## SOLUTION APPLIED ✅
1. **Changed import path in shared-sdk/src/index.ts:**
   - From: `'./aviation/weather'`
   - To: `'./aviation/weather/index'`

2. **Fixed flight-tracker imports:**
   - Removed non-existent 'Weather' namespace import
   - Changed to direct function imports (fetchMetarRaw, parseMetar, etc.)

## VERIFICATION ✅
- ✅ packages/shared-sdk builds successfully
- ✅ apps/weather-briefing builds successfully
- ✅ apps/flight-tracker builds successfully
- ✅ apps/aviation-accident-tracker builds successfully

## Impact Resolution
- ✅ ALL TypeScript apps can now build
- ✅ Railway deployments unblocked
- ✅ Local development working

## Commit
- 24ebef7: fix(P0): resolve TypeScript module resolution for weather exports
