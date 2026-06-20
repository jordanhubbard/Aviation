---
id: Aviation-dhw.2.1.2
status: closed
deps: [Aviation-dhw.2.1.1]
links: []
created: 2026-01-25T03:58:10.471436-08:00
type: task
priority: 2
parent: Aviation-dhw.2.1
mac-task-id: task_814933be8c0c43ec86b0bdb6da1e9bd4
---
# Task: Wire g1000-simulator into monorepo tooling

## Description
Register the new G1000 Simulator app with monorepo-level tooling and run targets.

## Requirements
- Add workspace entries (if needed) to root tooling
- Add Makefile run/test/build stubs for the new app
- Confirm `validate_beads.py` passes for the new structure

## Deliverables
- Monorepo tooling recognizes the g1000-simulator app

## Close Reason

Added g1000-simulator workspace entry, app Makefile stubs, and root run target; validated beads.
