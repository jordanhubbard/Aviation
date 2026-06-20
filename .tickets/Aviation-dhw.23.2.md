---
id: Aviation-dhw.23.2
status: open
deps: []
links: []
created: 2026-01-24T11:53:00.380947-08:00
type: task
priority: 2
parent: Aviation-dhw.23
mac-task-id: task_4c66e97fbcc947d6b89f06f946dde906
---
# Story: Performance optimization

## Targets
- PFD: 20 Hz updates
- MFD: 5 Hz updates
- WebSocket latency: < 50ms
- Memory usage: < 500 MB
- CPU usage: < 40% of one core

## Scope
- Rendering pipeline optimization
- Data streaming efficiency
- Debounce/throttle high-frequency updates
