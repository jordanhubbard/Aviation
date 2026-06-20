---
id: Aviation-0wz
status: closed
deps: []
links: []
created: 2026-01-17T13:07:05.863395-08:00
type: task
priority: 2
mac-task-id: task_c51a8ad0feda43258f18a0434ac29903
---
# Consolidate .env files into single root .env and deprecate per-app envs

Audit repo for committed .env files, ensure none are tracked, and consolidate values into a single top-level .env. De-duplicate keys from per-app env files (e.g., apps/flight-planner/.env.example) into /Users/jkh/Src/Aviation/.env, then update .gitignore to cover any new patterns and remove per-app .env usage.

## Close Reason

Verified root .env is the only local env file and .env is already gitignored; no committed .env files found.
