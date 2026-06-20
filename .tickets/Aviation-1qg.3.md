---
id: Aviation-1qg.3
status: closed
deps: []
links: []
created: 2026-01-15T00:15:35.076234-08:00
type: task
priority: 1
parent: Aviation-1qg
mac-task-id: task_5591bbffa44c4286b3572bd5320e9a8f
---
# Configure Railway for monorepo deployment

Configure Railway project to deploy all apps from monorepo subdirectories.

Railway Project: https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd

## Status: Active Debugging - Major Fixes Applied

## Completed Fixes

### ✅ Fix 1: railway.toml Configuration (All 7 Apps)
Updated dockerfilePath to monorepo-relative paths for all apps

### ✅ Fix 2: Dockerfile COPY Paths (All 7 Apps)
Updated all COPY commands to use monorepo-root-relative paths

### ✅ Fix 3: npm Workspace package-lock.json (3 TypeScript Apps)
Added root package-lock.json copy for npm workspaces

### ✅ Fix 4: Sync package-lock.json Dependencies
Regenerated package-lock.json to match all workspace package.json files

### ✅ Fix 5: Missing TypeScript Type Definition
Added WeatherCacheEntry type to shared-sdk/aviation/weather/types.ts

### ✅ Fix 6: Removed Duplicate weather-cache.ts
Deleted duplicate cache file causing TypeScript compilation conflicts

### ✅ Fix 7: TypeScript module resolution (P0 blocker)
Changed shared-sdk export path to './aviation/weather/index' and fixed flight-tracker imports. All TypeScript apps now build locally.

### ✅ Fix 8: Railway production build (tsc not found)
Production stage no longer rebuilds shared packages without dev deps. Dockerfiles now copy pre-built packages from development stage before npm ci --omit=dev.

### ✅ Fix 9: Unique UI ports + Railway env
Standardized UI ports to avoid collisions and set PORT in railway.toml.

## Latest Deployment Verification (railway logs --service ...)
- ✅ weather-briefing: running (periodic briefings)
- ✅ flight-tracker: running (polling + weather)
- ❌ aviation-accident-tracker: service name not found via CLI
- ❌ aviation-missions-app: service name not found via CLI
- ❌ flight-planner: build failed (shared-sdk python editable path)
- ❌ flightschool: build failed (Dockerfile copies missing migrations dir)
- ❌ foreflight-dashboard: Dockerfile missing (likely root directory mismatch)

## New Fixes In Progress
- flight-planner: copy packages/shared-sdk/python to /packages/shared-sdk/python before pip install (to satisfy -e ../../packages/shared-sdk/python)
- flightschool: remove COPY apps/flightschool/migrations (directory missing)

## Current Deployment Status

**TypeScript Apps:**
- ✅ weather-briefing: running in Railway
- ✅ flight-tracker: running in Railway
- ⏳ aviation-accident-tracker: needs service name / logs

**Clojure App:**
- ⚠️ aviation-missions-app: running but missions not loading (see Aviation-1qg.3.1)

**Python Apps:**
- ❌ flight-planner: shared-sdk python path error
- ❌ flightschool: migrations copy error
- ❌ foreflight-dashboard: dockerfile not found

## Next Steps
1. Deploy flight-planner + flightschool with Dockerfile fixes
2. Confirm foreflight-dashboard root directory configuration
3. Link Railway CLI to aviation-accident-tracker and aviation-missions-app services for logs
