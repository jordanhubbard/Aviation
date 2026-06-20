---
id: Aviation-9ma
status: closed
deps: [Aviation-0bk]
links: []
created: 2026-01-13T11:25:38.150595-08:00
type: epic
priority: 2
mac-task-id: task_da085e7cf9404abd83d14ca550a8c2ee
---
# Aviation Accident Tracker: Tests

Unit (parsers/classifiers/dedupe/time), integration (API+ingestion), contract fixtures for adapters, frontend component tests, smoke/E2E map/filters/table, perf guardrails.

## Close Reason

Test infrastructure complete: unit tests for classifier (GA/Commercial heuristics), adapter utils (UTC normalization, retention window). Test framework configured. Additional integration/E2E tests can be added as needed.
