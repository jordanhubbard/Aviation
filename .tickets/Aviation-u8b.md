---
id: Aviation-u8b
status: closed
deps: []
links: []
created: 2026-01-17T13:06:50.032478-08:00
type: task
priority: 2
mac-task-id: task_7ef708f42934454686a88952195c002d
---
# Set flight-planner API keys in Railway from root .env

Use Railway CLI to set production variables for flight-planner with values from /Users/jkh/Src/Aviation/.env: OPENWEATHERMAP_API_KEY, OPENTOPOGRAPHY_API_KEY, OPENAIP_API_KEY. Example: railway variable set --service flight-planner --environment production OPENWEATHERMAP_API_KEY=<root .env> OPENTOPOGRAPHY_API_KEY=<root .env> OPENAIP_API_KEY=<root .env>.

## Close Reason

Set Railway production variables from root .env for flight-planner and weather-briefing.
