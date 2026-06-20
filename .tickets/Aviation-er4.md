---
id: Aviation-er4
status: closed
deps: []
links: []
created: 2026-01-17T13:09:26.322303-08:00
type: task
priority: 2
mac-task-id: task_65847997c5c842c190d4e2b2027c3e12
---
# Set weather-briefing OPENAI_API_KEY in Railway from root .env

Use Railway CLI to set OPENAI_API_KEY for weather-briefing production using the OpenAI key from /Users/jkh/Src/Aviation/.env. Ensure the root .env key name matches OPENAI_API_KEY (currently appears as OPEN_API_KEY) before setting. Example: railway variable set --service weather-briefing --environment production OPENAI_API_KEY=<root .env>.

## Close Reason

Set Railway production variables from root .env for flight-planner and weather-briefing.
