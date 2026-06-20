---
id: Aviation-1qg.3.3
status: closed
deps: []
links: []
created: 2026-01-15T12:31:39.144896-08:00
type: task
priority: 1
parent: Aviation-1qg.3
mac-task-id: task_1af859b56cc549f28177eb8c718c6998
---
# aviation-missions-app: bootstrap missions.json + persist updates

Implemented missions.json bootstrap + persistence.

## Changes
- Added missions JSON storage helper: backend/src/aviation_missions/missions_storage.clj
- Startup now seeds from missions.json (generates from DB or missions.txt if missing)
- Admin create/update/delete and approvals persist missions.json
- Import endpoints (JSON/YAML) persist missions.json
- Export includes special_challenges
- Added Makefile target: generate-missions-json
- Generated apps/aviation-missions-app/missions.json from missions.txt
- Dockerfile copies missions.json into container
- README updated with bootstrap/persistence flow

## Acceptance Criteria
- ✅ missions.json exists and is generated from missions.txt
- ✅ Startup seeds DB from missions.json when empty
- ✅ Create/update flows write updated missions.json
- ✅ Documentation added to README
