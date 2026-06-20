---
id: Aviation-7a8
status: closed
deps: []
links: []
created: 2026-01-17T13:06:27.310914-08:00
type: bug
priority: 2
mac-task-id: task_03c0a8c6719e42338a88834479f7cb37
---
# Aviation-accidents: ingest persistence fails (lastID undefined)

Railway logs: 'Ingest persistence failed' / 'Initial ingest failed' with TypeError: Cannot read properties of undefined (reading 'lastID') at EventRepository.upsertEvent. Verify db.run wrapper preserves lastID and redeploy.

## Close Reason

Handled AVHerald fallback/fixture resolution and db.run lastID handling.
