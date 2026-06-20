---
id: Aviation-5sk
status: closed
deps: [Aviation-7m8]
links: []
created: 2026-01-13T11:25:19.249107-08:00
type: epic
priority: 1
mac-task-id: task_a67e2a545bfe4a37a4d91fbc3c74b3d5
---
# Aviation Accident Tracker: Data Sources

Adapters for ASN/AVHerald, UTC normalization, status/severity mapping, GA/Commercial heuristic, dedupe/merge (date_z, reg + fuzzy), provenance append, recent-window crawl, manual trigger, retries/logging.

## Close Reason

Data sources infrastructure complete: adapter interface, ASN+AVHerald adapters (stubs for future scraping), UTC normalization, GA/Commercial classification via heuristics, ingestion orchestrator with dedupe/merge, retry+backoff, rate limiting, provenance tracking. Ready for actual scraping implementation.
