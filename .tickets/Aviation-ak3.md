---
id: Aviation-ak3
status: closed
deps: []
links: []
created: 2026-01-17T13:25:55.55972-08:00
type: task
priority: 2
mac-task-id: task_fd829ce23b1b4f98a7fd837be90fbd08
---
# Set foreflight-dashboard secrets in Railway

Railway production variables missing: FOREFLIGHT_API_KEY, FOREFLIGHT_API_SECRET, SECRET_KEY (per config.py). Once keys are available, set via railway variable set --service foreflight-dashboard --environment production.

## Close Reason

Set SECRET_KEY for foreflight-dashboard in Railway production.
