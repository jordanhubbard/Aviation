---
id: flightplanner-eg2
status: closed
deps: []
links: []
created: 2025-12-21T07:17:13.929118-05:00
type: bug
priority: 1
mac-task-id: task_53c8ff8ab00744c696a4bb8e510beeaa
---
# Frontend: fix 'failed to fetch dynamically imported module' error

Observed error screen in production: "TypeError: failed to fetch dynamically imported module: https://flightplanner-..." (see screenshot).

Goal: diagnose and fix root cause.

Hypotheses to check:
- Deployed asset/chunk missing (404) or wrong path/baseUrl.
- Cache/service worker serving stale index.html referencing old chunk hashes.
- Incorrect content-type / CORS / CDN misconfig for JS chunks.
- Router dynamic import chunk split path regression.

Acceptance:
- Repro is understood and documented.
- Fix deployed so route loads without error.
- Add guard/telemetry to capture failing URL/status and improve user recovery (e.g., hard-reload prompt) if appropriate.

## Close Reason

Added one-time reload for Vite preload/dynamic import failures and prevented SPA fallback for missing /assets chunks.
