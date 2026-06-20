---
id: Aviation-dhw.2.7.2
status: closed
deps: [Aviation-dhw.2.7.1, Aviation-dhw.2.4.2]
links: []
created: 2026-01-25T04:21:33.269779-08:00
type: task
priority: 2
parent: Aviation-dhw.2.7
mac-task-id: task_e6b809b13716474a8ec6ac75cf6c0258
---
# Task: Wire WebSocket telemetry into state store

## Description
Connect WebSocket telemetry to the frontend state store.

## Requirements
- Map incoming telemetry payloads to store updates
- Handle snapshot vs. incremental updates
- Surface connection status to UI components

## Deliverables
- WebSocket-driven state updates available to PFD/MFD components

## Close Reason

Wired telemetry socket updates into the flight store with snapshot/delta merging and connection status tracking.
