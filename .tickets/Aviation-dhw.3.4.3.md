---
id: Aviation-dhw.3.4.3
status: closed
deps: [Aviation-dhw.3.4.2]
links: []
created: 2026-01-25T10:24:26.363138-08:00
type: task
priority: 2
parent: Aviation-dhw.3.4
mac-task-id: task_cf3c6436136740548f475d2e2aea1cb2
---
# Task: Add mode capture logic and safeguards

## Description
Add autopilot mode capture logic and protective safeguards.

## Requirements
- Implement mode capture transitions (HDG/NAV/ALT/VS)
- Enforce pitch/bank limits and disconnect triggers
- Expose status for annunciations

## Deliverables
- Autopilot mode capture and safety behaviors

## Close Reason

Implemented autopilot mode capture logic with safeguards and exposed status in telemetry.
