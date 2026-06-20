---
id: flightplanner-7wj
status: closed
deps: []
links: []
created: 2025-12-17T21:08:09.064307-05:00
type: feature
priority: 1
mac-task-id: task_6764a239a0694651b3a37fbe0358ceef
---
# Prepare Railway deployment (PORT + env var wiring)

Adjust backend/frontend Dockerfiles and runtime env injection so Railway can set PORT and API keys via UI (OPENWEATHERMAP_API_KEY, OPENAIP_API_KEY, OPENTOPOGRAPHY_API_KEY). Remove need to configure VITE_OPENWEATHERMAP_API_KEY manually by mapping from OPENWEATHERMAP_API_KEY.

## Close Reason

Updated backend/frontend Dockerfiles for Railway (PORT binding, nginx proxy via BACKEND_URL, runtime env.js injection), added Git LFS data cache downloader for Railway builds, and updated env example
