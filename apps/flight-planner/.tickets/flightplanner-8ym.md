---
id: flightplanner-8ym
status: closed
deps: []
links: []
created: 2025-12-18T22:45:59.086421-05:00
type: bug
priority: 1
mac-task-id: task_23cd740f96e64402a942d76588a10afb
---
# aviation-missions-app CI: health monitoring job checks too early

In run https://github.com/jordanhubbard/aviation-missions-app/actions/runs/20358738331 job 🏥 Health Monitoring (ID 58499484487), the workflow starts the container and immediately curls http://localhost:8080/health; it fails on iteration 1 before the app is ready and container logs are empty. Fix by adding a startup grace period / retry loop (e.g., wait up to 60s for /health to return 200 before starting the 5-minute monitoring loop), or use docker healthcheck.

## Close Reason

Fixed in aviation-missions-app: added /health warmup retries in nightly workflow
