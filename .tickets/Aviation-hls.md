---
id: Aviation-hls
status: closed
deps: []
links: []
created: 2026-01-17T13:06:22.534446-08:00
type: bug
priority: 2
mac-task-id: task_e5823fbedcc04749886f0d181e21cc94
---
# Aviation-accidents: AVHerald fixture missing in dist

Railway logs show fallback fixture read failed: ENOENT for '/app/backend/dist/data/avherald-feed.xml' when AVHerald feed fails. Ensure fixture is packaged into dist or remove fixture fallback.

## Close Reason

Handled AVHerald fallback/fixture resolution and db.run lastID handling.
