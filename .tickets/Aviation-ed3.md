---
id: Aviation-ed3
status: closed
deps: []
links: []
created: 2026-01-17T13:06:54.488911-08:00
type: task
priority: 2
mac-task-id: task_acc6d9e6063e469cbb2db7506edfb950
---
# Set weather-briefing OPENWEATHERMAP_API_KEY in Railway from root .env

Use Railway CLI to set OPENWEATHERMAP_API_KEY for weather-briefing production using the value from /Users/jkh/Src/Aviation/.env. Example: railway variable set --service weather-briefing --environment production OPENWEATHERMAP_API_KEY=<root .env>.

## Close Reason

Set Railway production variables from root .env for flight-planner and weather-briefing.
