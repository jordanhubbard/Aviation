---
id: Aviation-dhw.8.4
status: open
deps: []
links: []
created: 2026-01-24T11:46:33.749577-08:00
type: task
priority: 2
parent: Aviation-dhw.8
mac-task-id: task_b7edbff47ecf461b8521d355526f78be
---
# Story: Real-time data streaming service

## Responsibilities
- WebSocket server for real-time data streaming
- Flight state distribution to multiple displays
- Performance optimization for high-frequency updates (20Hz+)

## Key Modules
- `websocket-server.ts`
- `data-publisher.ts`
- `subscriber-manager.ts`
- `message-serializer.ts`

## WebSocket Messages
- `FLIGHT_STATE` (20Hz)
- `PFD_UPDATE` (20Hz)
- `MFD_UPDATE` (5Hz)
- `NAV_UPDATE` (2Hz)
- `SYSTEM_STATUS` (1Hz)
