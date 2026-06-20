---
id: Aviation-dhw.14.1
status: closed
deps: []
links: []
created: 2026-01-24T11:49:16.992133-08:00
type: task
priority: 2
parent: Aviation-dhw.14
mac-task-id: task_a9c0d10588274413a28ba2f30880e5fd
---
# Story: Lateral mode state machine

## State Diagram
```
[OFF] → ROL (default when AP engaged)
ROL ↔ HDG (heading select)
ROL/HDG → NAV (when flight plan active)
NAV → APR (when approach armed)
APR → BC (backcourse mode)
```

## Modes
- ROL, HDG, NAV, APR, BC

## Close Reason

Closed
