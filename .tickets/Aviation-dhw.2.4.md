---
id: Aviation-dhw.2.4
status: closed
deps: []
links: []
created: 2026-01-24T11:43:33.886333-08:00
type: task
priority: 2
parent: Aviation-dhw.2
mac-task-id: task_a675199e4e6048ebba22bd7124fb67b3
---
# Story: WebSocket communications foundation

## Description
Implement foundational WebSocket server/client communications for real-time simulator data.

## Requirements
- WebSocket server for streaming flight state and display data
- Client subscription management for PFD/MFD
- Message types and update rates:
  - `FLIGHT_STATE` (20Hz)
  - `PFD_UPDATE` (20Hz)
  - `MFD_UPDATE` (5Hz)
  - `NAV_UPDATE` (2Hz)
  - `SYSTEM_STATUS` (1Hz)
- Efficient serialization (binary or compact JSON)

## Deliverables
- WebSocket server skeleton
- Client hookup in frontend
- Message schema placeholders

## Close Reason

Closed
