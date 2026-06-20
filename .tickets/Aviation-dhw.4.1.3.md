---
id: Aviation-dhw.4.1.3
status: closed
deps: [Aviation-dhw.4.1.2]
links: []
created: 2026-01-25T10:33:27.10778-08:00
type: task
priority: 2
parent: Aviation-dhw.4.1
mac-task-id: task_c119a345534b47539774f01bcf6f0cfc
---
# Task: Add primitives test harness

## Description
Create a lightweight test harness or storybook-style view for rendering primitives.

## Requirements
- Provide visual smoke test page for primitives
- Capture baseline snapshots if possible
- Keep harness isolated from production bundle

## Deliverables
- Primitive rendering harness for validation

## Close Reason

Added a standalone harness HTML page and React canvas renderer to exercise g1000-rendering primitives in the g1000-simulator frontend.
