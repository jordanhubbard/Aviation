---
id: Aviation-i26
status: closed
deps: []
links: []
created: 2026-01-17T13:06:18.355421-08:00
type: bug
priority: 2
mac-task-id: task_74710f91fb17460b9f45743c0a9032cc
---
# Aviation-accidents: AVHerald RSS returns 404

Railway logs show ingest fallback due to AVHerald feed failure: '[avherald] falling back to fixtures Error: AVHerald feed HTTP 404' in aviation-accidents service. Investigate feed URL or replace AVHerald source.

## Close Reason

Handled AVHerald fallback/fixture resolution and db.run lastID handling.
