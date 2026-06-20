---
id: Aviation-dhw.4.2.3
status: closed
deps: [Aviation-dhw.4.2.2]
links: []
created: 2026-01-25T10:33:43.974693-08:00
type: task
priority: 2
parent: Aviation-dhw.4.2
mac-task-id: task_8c359b246edf4f52bde30c86aa3ad965
---
# Task: Add PFD render performance hooks

## Description
Add performance hooks and instrumentation for the PFD rendering pipeline.

## Requirements
- Track frame time and update cadence
- Provide logging hooks for perf diagnostics
- Prepare for performance tests

## Deliverables
- PFD render performance instrumentation

## Close Reason

Added PFD pipeline performance hooks to track frame cadence and render timings with logging callbacks.
