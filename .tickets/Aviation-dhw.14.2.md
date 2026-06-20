---
id: Aviation-dhw.14.2
status: closed
deps: []
links: []
created: 2026-01-24T11:49:21.124412-08:00
type: task
priority: 2
parent: Aviation-dhw.14
mac-task-id: task_379bf9dee9084936b41ab8b44bad873c
---
# Story: Vertical mode state machine

## State Diagram
```
[OFF] → PIT (default when AP engaged)
PIT ↔ VS (vertical speed select)
PIT/VS → ALTS (altitude capture armed when within 1000ft)
ALTS → ALT (altitude hold when within ±50ft)
VS/ALTS → GS/GP (glideslope/glidepath capture)
```

## Modes
- PIT, VS, ALT, ALTS, VPTH, GS, GP

## Close Reason

Closed
