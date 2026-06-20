---
id: Aviation-cr3
status: closed
deps: []
links: []
created: 2026-01-17T13:06:31.64431-08:00
type: bug
priority: 2
mac-task-id: task_b02875da482d496c9b61a473924090a4
---
# Flight-tracker: OpenSky API 429 rate limit

Railway logs show 'Unable to refresh live flights: OpenSky error: 429'. Add rate-limit handling/backoff and/or configure credentials to reduce throttling.

## Close Reason

Added OpenSky rate-limit backoff handling to avoid repeated 429 errors.
