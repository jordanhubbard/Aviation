---
id: Aviation-dhw.2.8
status: closed
deps: []
links: []
created: 2026-01-24T11:44:03.506179-08:00
type: task
priority: 2
parent: Aviation-dhw.2
mac-task-id: task_e62ed7f3d967490da5b7bc5d82ecd8d0
---
# Story: Reuse existing Aviation SDKs and services

## Description
Plan and integrate reuse of existing monorepo SDKs/services where applicable.

## @aviation/shared-sdk
- Service base classes (BackgroundService, ServiceConfig)
- API utilities (rate limiting, retries)
- Validation patterns
- Logging and error handling

## @aviation/keystore
- Store weather API keys, configuration secrets, DB credentials

## @aviation/ui-framework
- Multi-tab integration as a pane
- Shared UI components (layouts, modals, toasts, spinners)

## apps/flight-planner
- Route calculation algorithms
- Great circle distance calculations
- Waypoint management
- Airport database queries

## apps/weather-briefing
- METAR/TAF fetching and decoding
- Weather data caching
- Severe weather alert patterns

## packages/shared-sdk/python
- `aviation.geo` (geodetic calculations)
- `aviation.units` (unit conversions)
- `aviation.time` (Zulu/local time utilities)

## Close Reason

Closed
