# Scheduled Ingestion - Aviation Accident Tracker

## Overview

The Aviation Accident Tracker includes automated scheduled ingestion that periodically fetches new accident/incident data from configured sources (ASN and AVHerald).

## Features

- ✅ **Automated ingestion** every 6 hours (configurable)
- ✅ **Configurable time window** (default: last 40 days)
- ✅ **Graceful shutdown** (completes current run before stopping)
- ✅ **Health monitoring** via `/health` endpoint
- ✅ **Error tracking** and logging
- ✅ **Can be disabled** via environment variable
- ✅ **Manual trigger** via API endpoint
- ✅ **Metrics tracking** (events ingested, updated, errors)

## Configuration

### Environment Variables

```bash
# Enable/disable scheduled ingestion (default: enabled)
ENABLE_CRON=true

# Cron schedule (default: every 6 hours at :00 minutes)
INGEST_CRON="0 */6 * * *"

# Time window for ingestion in days (default: 40)
INGEST_WINDOW_DAYS=40

# Authentication token for manual ingestion endpoint
INGESTION_TOKEN=your-secure-token-here
```

### Cron Schedule Format

The `INGEST_CRON` uses standard cron syntax:

```
┌────────────── minute (0 - 59)
│ ┌──────────── hour (0 - 23)
│ │ ┌────────── day of month (1 - 31)
│ │ │ ┌──────── month (1 - 12)
│ │ │ │ ┌────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

**Common schedules:**
- `0 */6 * * *` - Every 6 hours at :00 minutes (default)
- `0 */4 * * *` - Every 4 hours at :00 minutes
- `0 */12 * * *` - Every 12 hours at :00 minutes
- `0 0 * * *` - Once per day at midnight
- `0 0 * * 0` - Once per week on Sunday at midnight
- `*/30 * * * *` - Every 30 minutes

## Usage

### Starting with Scheduler Enabled (Default)

```bash
# Start server (scheduler runs automatically)
npm start

# Or with Docker
docker-compose up
```

### Disabling the Scheduler

```bash
# Disable scheduler temporarily
ENABLE_CRON=false npm start

# Or via environment file
echo "ENABLE_CRON=false" >> .env
npm start
```

### Customizing Schedule

```bash
# Run every 4 hours
INGEST_CRON="0 */4 * * *" npm start

# Run once per day at 2 AM
INGEST_CRON="0 2 * * *" npm start

# Run twice per day (8 AM and 8 PM)
INGEST_CRON="0 8,20 * * *" npm start
```

### Customizing Time Window

```bash
# Fetch last 7 days only
INGEST_WINDOW_DAYS=7 npm start

# Fetch last 90 days
INGEST_WINDOW_DAYS=90 npm start
```

## Monitoring

### Health Check

The `/health` endpoint includes scheduler status:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-14T10:30:00.000Z",
  "env": "development",
  "scheduler": {
    "enabled": true,
    "running": true,
    "schedule": "0 */6 * * *",
    "windowDays": 40,
    "lastRun": {
      "started": "2024-01-14T08:00:00.000Z",
      "finished": "2024-01-14T08:02:15.000Z",
      "success": true,
      "eventsIngested": 12,
      "eventsUpdated": 3,
      "errors": 0
    },
    "currentlyIngesting": false
  }
}
```

### Scheduler Status Fields

- **enabled** (boolean): Whether scheduler is configured to run
- **running** (boolean): Whether scheduler is actively running (not paused)
- **schedule** (string): Cron schedule being used
- **windowDays** (number): Time window in days
- **lastRun** (object|null): Information about the last ingestion run
  - **started** (string): ISO timestamp when run started
  - **finished** (string): ISO timestamp when run completed
  - **success** (boolean): Whether run completed successfully
  - **eventsIngested** (number): Number of new events added
  - **eventsUpdated** (number): Number of existing events updated
  - **errors** (number): Number of errors encountered
  - **errorMessage** (string): Error details if run failed
- **currentlyIngesting** (boolean): Whether an ingestion is currently in progress

### Logs

Scheduler activity is logged at appropriate levels:

```bash
# View scheduler logs
docker-compose logs -f | grep scheduler

# Or if running directly
tail -f logs/application.log | grep scheduler
```

**Log Messages:**
- `[scheduler] Starting scheduled ingestion` - Run started
- `[scheduler] Scheduled ingestion completed successfully` - Run succeeded
- `[scheduler] Scheduled ingestion failed` - Run failed
- `[scheduler] Ingestion already running, skipping this run` - Overlap detected
- `[scheduler] SIGTERM received, stopping scheduler...` - Graceful shutdown

## Manual Ingestion

You can trigger ingestion manually via the API endpoint:

```bash
curl -X POST http://localhost:3000/api/ingest/run \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "windowDays": 40
  }'
```

This is useful for:
- Testing ingestion without waiting for scheduled run
- Backfilling data after system downtime
- One-off data refreshes

## Graceful Shutdown

The scheduler handles shutdown signals gracefully:

```bash
# Send SIGTERM (Docker Compose, systemd, Kubernetes)
docker-compose stop

# Send SIGINT (Ctrl+C in terminal)
# Press Ctrl+C
```

**Shutdown behavior:**
1. HTTP server stops accepting new connections
2. If ingestion is running, it completes current run
3. Scheduler is stopped
4. Process exits cleanly

This ensures:
- No partial data ingestion
- No database corruption
- Clean process termination

## Error Handling

### Automatic Retries

If ingestion fails, it will be attempted again at the next scheduled time. Errors are logged and tracked in the health endpoint.

### Error Types

1. **Network errors** - Source website unavailable
   - Logged and retried at next schedule
   - Check logs for connectivity issues

2. **Parsing errors** - Source HTML format changed
   - Logged with details
   - May require adapter updates

3. **Database errors** - Write failures
   - Logged with stack trace
   - Check database health and disk space

### Alerting

To set up alerting for ingestion failures:

1. **Monitor `/health` endpoint**
   ```bash
   # Check if last run failed
   curl http://localhost:3000/health | jq '.scheduler.lastRun.success'
   ```

2. **Monitor logs for errors**
   ```bash
   # Look for error log entries
   grep "Scheduled ingestion failed" logs/application.log
   ```

3. **Set up external monitoring**
   - Use a service like UptimeRobot, Datadog, or Prometheus
   - Alert if health check fails or last run was unsuccessful

## Performance

### Resource Usage

Typical ingestion run (40-day window):
- **Duration**: 30-120 seconds
- **Memory**: +50-100MB during run
- **CPU**: Moderate (parsing HTML, database writes)
- **Network**: 1-5 MB download (HTML pages)

### Optimization

**Reduce time window** if ingestion takes too long:
```bash
# Only fetch last 14 days
INGEST_WINDOW_DAYS=14
```

**Adjust schedule** for quieter periods:
```bash
# Run during off-peak hours
INGEST_CRON="0 2,8,14,20 * * *"
```

**Monitor database growth**:
```bash
# Check database size
ls -lh data/accidents.db
```

## Troubleshooting

### Scheduler Not Running

**Check environment variable:**
```bash
echo $ENABLE_CRON
# Should be unset or "true"
```

**Check logs:**
```bash
grep "Starting scheduled ingestion" logs/application.log
```

### No New Events

**Check last run status:**
```bash
curl http://localhost:3000/health | jq '.scheduler.lastRun'
```

**Verify time window:**
```bash
# Most new incidents are within last 7 days
INGEST_WINDOW_DAYS=7
```

### Ingestion Taking Too Long

**Reduce time window:**
```bash
INGEST_WINDOW_DAYS=14  # Instead of 40
```

**Check network connectivity:**
```bash
# Test source availability
curl -I https://aviation-safety.net
curl -I https://avherald.com
```

### Overlapping Runs

If runs overlap (current run not finished before next schedule):
```bash
# Logs will show: "Ingestion already running, skipping this run"
# Increase schedule interval:
INGEST_CRON="0 */12 * * *"  # Every 12 hours instead of 6
```

## Production Recommendations

### Monitoring

1. **Set up health check monitoring**
   - Monitor `/health` endpoint every 5 minutes
   - Alert if `scheduler.lastRun.success` is false

2. **Log aggregation**
   - Send logs to centralized logging (Datadog, Splunk, ELK)
   - Create alerts for "Scheduled ingestion failed"

3. **Metrics tracking**
   - Track `eventsIngested` and `eventsUpdated` over time
   - Alert on anomalies (0 events for multiple runs, unusually high errors)

### Configuration

1. **Appropriate schedule**
   - Production: `0 */6 * * *` (every 6 hours)
   - Development: `0 */12 * * *` (every 12 hours)
   - Testing: Manual trigger only (ENABLE_CRON=false)

2. **Reasonable time window**
   - 40 days is good default for catching late-reported incidents
   - Can reduce to 14-30 days for faster runs

3. **Secure authentication**
   - Use strong, random token for INGESTION_TOKEN
   - Rotate tokens periodically

### High Availability

For production HA setups with multiple instances:

1. **Run scheduler on single instance only**
   ```bash
   # Primary instance
   ENABLE_CRON=true

   # Secondary instances
   ENABLE_CRON=false
   ```

2. **Or use external scheduler**
   - Disable built-in scheduler (`ENABLE_CRON=false`)
   - Use Kubernetes CronJob or external cron to call API endpoint
   - Provides better control in distributed environments

## Example Configurations

### Development

```bash
# .env.development
ENABLE_CRON=true
INGEST_CRON="0 */12 * * *"  # Every 12 hours
INGEST_WINDOW_DAYS=14        # Last 2 weeks
INGESTION_TOKEN=dev-token
```

### Staging

```bash
# .env.staging
ENABLE_CRON=true
INGEST_CRON="0 */8 * * *"   # Every 8 hours
INGEST_WINDOW_DAYS=30       # Last month
INGESTION_TOKEN=staging-secure-token
```

### Production

```bash
# .env.production
ENABLE_CRON=true
INGEST_CRON="0 */6 * * *"   # Every 6 hours
INGEST_WINDOW_DAYS=40       # Last 40 days
INGESTION_TOKEN=<secure-random-token>
```

### High-Availability Production

```bash
# Primary instance
ENABLE_CRON=true
INGEST_CRON="0 */6 * * *"
INGEST_WINDOW_DAYS=40

# Secondary instances (schedulerless)
ENABLE_CRON=false
```

## Support

For issues or questions:
- Check logs for error messages
- Verify configuration via `/health` endpoint
- Review this documentation
- Open an issue on GitHub

## License

MIT License - See LICENSE file for details
