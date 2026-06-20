---
id: Aviation-dhw.2.4.2
status: closed
deps: [Aviation-dhw.2.4.1, Aviation-dhw.2.3.1]
links: []
created: 2026-01-25T04:20:54.69438-08:00
type: task
priority: 2
parent: Aviation-dhw.2.4
mac-task-id: task_d92bf8dd47634016b2c344bae4d3c9f4
---
# Task: Implement frontend WebSocket client hook

## Description
Add the frontend WebSocket client layer for consuming simulator telemetry.

## Requirements
- Create reusable WebSocket hook/client
- Handle reconnect/backoff and connection status
- Stub parsing for flight state payloads

## Deliverables
- Frontend WebSocket client ready to wire into state management

## Close Reason

Added reusable WebSocket client hook with reconnect/backoff and wired telemetry/command hooks to use it.
