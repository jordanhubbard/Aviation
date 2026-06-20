---
id: Aviation-1qg.3.1
status: closed
deps: []
links: []
created: 2026-01-15T09:55:41.620117-08:00
type: bug
priority: 1
parent: Aviation-1qg.3
mac-task-id: task_7328cadb44574d8c9c773364ac82c419
---
# aviation-missions-app: Missing missions in production deployment

The aviation-missions-app deployed at https://aviation-missions-production.up.railway.app/ is running but has no missions loaded.

## Root Cause
Railway persists the H2 database file (/app/data/aviation-missions.mv.db) across deployments, but the missions table is empty. The seeding logic only runs if the database doesn't exist, not if it exists but is empty.

## Solution Implemented
Added FORCE_RESEED environment variable support in core.clj:
- When FORCE_RESEED=true, deletes existing missions and re-seeds from missions.txt
- Logs the re-seeding operation for debugging

## Current Blocker
Railway CLI is linked to service weather-briefing only. CLI cannot list or query logs for other services without linking a specific service (TTY prompt required).

## Next Steps (manual)
1. Run: railway service link
2. Select service: aviation-missions-app
3. Run: railway logs --lines 200 --latest
4. Confirm logs show reseed and missions count
5. If reseed did not run:
   - Ensure FORCE_RESEED=true is set in Variables
   - Trigger redeploy
6. Remove FORCE_RESEED after successful seed

## Verification Target
https://aviation-missions-production.up.railway.app/

## Commit
- 1755fd0: fix(aviation-missions): add FORCE_RESEED env var to reload missions
