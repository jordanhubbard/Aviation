---
id: flightplanner-x0j
status: closed
deps: []
links: []
created: 2025-12-17T21:51:38.31102-05:00
type: feature
priority: 1
mac-task-id: task_26fa35894b2a4cdb890bfda77b570d82
---
# Support single-service Railway deploy from repo root

Railway is building from the repo root with Railpack and can't find a start command. Add a root Dockerfile that builds frontend + backend into one container (FastAPI serves the SPA + /env.js) so a single Railway service can deploy the whole repo.

## Close Reason

Added repo-root Dockerfile that builds frontend+backend into one container and updated FastAPI app to serve the SPA + /env.js for runtime OpenWeather key injection
