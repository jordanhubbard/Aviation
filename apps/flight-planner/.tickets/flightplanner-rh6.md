---
id: flightplanner-rh6
status: closed
deps: []
links: []
created: 2025-12-17T21:27:15.135954-05:00
type: chore
priority: 2
mac-task-id: task_34c14fb62f4b4ed99b75dd625860c0a2
---
# Bind services for Railway private networking (IPv6)

Railway private networking expects services to listen on :: for IPv6; update backend uvicorn CMD and nginx listen directives accordingly.

## Close Reason

Backend uvicorn now binds to :: in Dockerfile; nginx listens on both [::]:PORT and PORT for dual-stack
