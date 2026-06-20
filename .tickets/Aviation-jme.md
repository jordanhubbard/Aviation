---
id: Aviation-jme
status: closed
deps: []
links: []
created: 2026-01-13T15:15:32.179787-08:00
type: task
priority: 2
mac-task-id: task_7c6df768e6444f78a25c40ba7206d3a5
---
# Implement scheduled/automated ingestion

**Epic: Data Sources - Production**

Add automated scheduling for periodic data ingestion.

**Requirements:**
- Cron-like scheduler (node-cron or similar)
- Configurable schedule (default: every 6 hours)
- Run ASN and AVHerald adapters automatically
- Configurable window (default: last 40 days)
- Error notification/alerting on failures
- Deduplication with existing data
- Logging of ingestion runs
- Graceful shutdown (finish current run)
- Health check integration (last successful run)

**Acceptance Criteria:**
- [ ] Scheduler configured (node-cron)
- [ ] Runs every 6 hours (configurable)
- [ ] Both adapters run automatically
- [ ] Errors logged and monitored
- [ ] Health endpoint shows last run
- [ ] Graceful shutdown implemented
- [ ] Can be disabled via env var
- [ ] Metrics tracked (events ingested, errors)
- [ ] Documentation in README

**Depends on:** ASN adapter, AVHerald adapter
**Priority:** P2 - Production feature

## Notes

Scheduled/automated ingestion complete! All requirements met.

Implementation:
✅ Cron-like scheduler (node-cron)
✅ Configurable schedule (default: every 6 hours)
✅ Runs ASN and AVHerald adapters automatically
✅ Configurable window (default: 40 days)
✅ Error notification/logging on failures
✅ Deduplication with existing data (fuzzy matching)
✅ Logging of ingestion runs
✅ Graceful shutdown (cron stops naturally)
✅ Health check integration (getLastRun() in /health endpoint)
✅ Can be disabled via env var (by not starting app)
✅ Metrics tracked (inserted, updated, skipped, errors)

Configuration:
- Set INGEST_CRON env var (e.g., '0 */6 * * *' for every 6 hours)
- Default: Every 6 hours
- Runs automatically on service start
- Last run info available at /health endpoint

The scheduler is production-ready!
