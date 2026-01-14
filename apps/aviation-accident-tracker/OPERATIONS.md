# Aviation Accident Tracker - Operations Guide

> Comprehensive operational documentation for deployment, maintenance, and troubleshooting

**Last Updated**: 2026-01-14  
**Version**: 1.0.0  
**Part of**: [Aviation Monorepo](../../README.md)

---

## Table of Contents

1. [Deployment](#deployment)
2. [Environment Variables](#environment-variables)
3. [Database Management](#database-management)
4. [Monitoring & Logging](#monitoring--logging)
5. [Ingestion Management](#ingestion-management)
6. [Troubleshooting](#troubleshooting)
7. [Scaling](#scaling)
8. [Disaster Recovery](#disaster-recovery)
9. [Security](#security)
10. [Performance Tuning](#performance-tuning)

---

## Deployment

### Docker Deployment

#### Prerequisites
- Docker 24+
- Docker Compose 2.20+
- 1GB RAM minimum, 2GB recommended
- 500MB disk space for database

#### Local Development Deployment

```bash
# From monorepo root
cd apps/aviation-accident-tracker

# Build and start all services
make docker-up

# Services will be available at:
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:8080
# - Database: SQLite file at backend/data/accidents.db

# View logs
make docker-logs

# Stop services
make docker-down

# Clean up (remove volumes)
make docker-clean
```

#### Production Docker Deployment

```bash
# Build production image
docker build -t aviation-accident-tracker:latest .

# Run production container
docker run -d \
  --name accident-tracker \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e DATABASE_PATH=/data/accidents.db \
  -e LOG_LEVEL=info \
  -v /path/to/data:/data \
  aviation-accident-tracker:latest

# Health check
curl http://localhost:8080/api/health
```

**docker-compose.yml** (Production):

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      NODE_ENV: production
      DATABASE_PATH: /data/accidents.db
      LOG_LEVEL: info
      PORT: 8080
    volumes:
      - accident-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  accident-data:
    driver: local
```

### Railway Deployment

#### Setup

1. **Create Railway Project**:
   ```bash
   railway init
   railway link <project-id>
   ```

2. **Configure Service**:
   ```bash
   # Set environment variables
   railway variables set NODE_ENV=production
   railway variables set LOG_LEVEL=info
   railway variables set PORT=8080
   
   # Deploy
   railway up
   ```

3. **Railway Configuration** (`railway.toml`):
   ```toml
   [build]
   builder = "NIXPACKS"
   buildCommand = "cd backend && npm ci && npm run build"
   
   [deploy]
   startCommand = "cd backend && npm start"
   restartPolicyType = "ON_FAILURE"
   restartPolicyMaxRetries = 10
   
   [healthcheck]
   path = "/api/health"
   port = 8080
   interval = 30
   timeout = 10
   ```

4. **Enable Volume for Database**:
   - Go to Railway dashboard
   - Add volume: `/data` (mount path)
   - Set `DATABASE_PATH=/data/accidents.db`

#### Post-Deployment

```bash
# Check logs
railway logs

# Run initial ingestion
railway run npm run ingest
```

### Fly.io Deployment

#### Setup

1. **Install Fly CLI**:
   ```bash
   brew install flyctl  # macOS
   # or
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login and Initialize**:
   ```bash
   flyctl auth login
   cd apps/aviation-accident-tracker
   flyctl launch --name accident-tracker
   ```

3. **Fly Configuration** (`fly.toml`):
   ```toml
   app = "accident-tracker"
   primary_region = "sjc"  # or your preferred region
   
   [build]
   dockerfile = "Dockerfile"
   
   [env]
   NODE_ENV = "production"
   PORT = "8080"
   LOG_LEVEL = "info"
   DATABASE_PATH = "/data/accidents.db"
   
   [[services]]
   internal_port = 8080
   protocol = "tcp"
   
   [[services.ports]]
   handlers = ["http"]
   port = 80
   
   [[services.ports]]
   handlers = ["tls", "http"]
   port = 443
   
   [[services.http_checks]]
   interval = "30s"
   timeout = "10s"
   grace_period = "30s"
   method = "get"
   path = "/api/health"
   
   [mounts]
   source = "accident_data"
   destination = "/data"
   ```

4. **Create Volume**:
   ```bash
   flyctl volumes create accident_data --region sjc --size 1
   ```

5. **Deploy**:
   ```bash
   flyctl deploy
   ```

6. **Post-Deployment**:
   ```bash
   # Check logs
   flyctl logs
   
   # SSH into instance
   flyctl ssh console
   
   # Run ingestion
   flyctl ssh console -C "cd /app/backend && npm run ingest"
   ```

### Kubernetes Deployment

#### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: accident-tracker
  labels:
    app: accident-tracker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: accident-tracker
  template:
    metadata:
      labels:
        app: accident-tracker
    spec:
      containers:
      - name: app
        image: aviation-accident-tracker:latest
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "8080"
        - name: DATABASE_PATH
          value: "/data/accidents.db"
        - name: LOG_LEVEL
          value: "info"
        volumeMounts:
        - name: data
          mountPath: /data
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: accident-data-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: accident-tracker
spec:
  selector:
    app: accident-tracker
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: LoadBalancer
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: accident-data-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

---

## Environment Variables

### Core Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment: `development`, `production` |
| `PORT` | No | `8080` | Backend HTTP port |
| `DATABASE_PATH` | No | `./data/accidents.db` | SQLite database file path |
| `LOG_LEVEL` | No | `info` | Log level: `debug`, `info`, `warn`, `error` |

### Ingestion Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `INGEST_BATCH_SIZE` | No | `100` | Batch size for database inserts |
| `INGEST_TIMEOUT_MS` | No | `30000` | HTTP request timeout (ms) |
| `INGEST_RETRY_COUNT` | No | `3` | Number of retries for failed requests |
| `INGEST_RETRY_DELAY_MS` | No | `1000` | Delay between retries (ms) |

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window (ms) |

### Frontend Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | `http://localhost:8080` | Backend API URL |

### Example `.env` Files

**Development** (`.env.development`):
```env
NODE_ENV=development
PORT=8080
DATABASE_PATH=./data/accidents.db
LOG_LEVEL=debug
```

**Production** (`.env.production`):
```env
NODE_ENV=production
PORT=8080
DATABASE_PATH=/data/accidents.db
LOG_LEVEL=info
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

---

## Database Management

### Backup Procedures

#### Manual Backup

```bash
# Stop the service (to ensure consistency)
make stop-backend

# Create backup with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp backend/data/accidents.db backup/accidents_${TIMESTAMP}.db

# Compress backup
gzip backup/accidents_${TIMESTAMP}.db

# Restart service
make start-backend
```

#### Automated Backup Script

```bash
#!/bin/bash
# scripts/backup-database.sh

set -e

DATABASE_PATH=${DATABASE_PATH:-"./backend/data/accidents.db"}
BACKUP_DIR=${BACKUP_DIR:-"./backup"}
RETENTION_DAYS=${RETENTION_DAYS:-7}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/accidents_${TIMESTAMP}.db"

# Create backup (SQLite-specific)
sqlite3 "$DATABASE_PATH" ".backup '$BACKUP_FILE'"

# Compress
gzip "$BACKUP_FILE"

echo "Backup created: ${BACKUP_FILE}.gz"

# Cleanup old backups
find "$BACKUP_DIR" -name "accidents_*.db.gz" -mtime +$RETENTION_DAYS -delete

echo "Old backups (>$RETENTION_DAYS days) removed"
```

#### Cron Job Setup

```cron
# Run backup daily at 2 AM
0 2 * * * /path/to/apps/aviation-accident-tracker/scripts/backup-database.sh >> /var/log/accident-tracker-backup.log 2>&1
```

### Restore Procedures

#### Restore from Backup

```bash
# Stop the service
make stop-backend

# Restore from backup
gunzip -c backup/accidents_20260114_020000.db.gz > backend/data/accidents.db

# Verify integrity
sqlite3 backend/data/accidents.db "PRAGMA integrity_check;"

# Restart service
make start-backend
```

#### Restore from SQL Dump

```bash
# Create SQL dump (for version control or migration)
sqlite3 backend/data/accidents.db .dump > backup/accidents_schema_and_data.sql

# Restore from SQL dump
sqlite3 backend/data/accidents_new.db < backup/accidents_schema_and_data.sql
```

### Database Maintenance

#### Vacuum Database

```bash
# Reclaim unused space and defragment
sqlite3 backend/data/accidents.db "VACUUM;"
```

#### Analyze Database

```bash
# Update statistics for query optimizer
sqlite3 backend/data/accidents.db "ANALYZE;"
```

#### Check Integrity

```bash
# Verify database integrity
sqlite3 backend/data/accidents.db "PRAGMA integrity_check;"
```

### Migration Strategy

#### Schema Versioning

Create migration files in `backend/migrations/`:

```typescript
// backend/migrations/001_initial_schema.ts
export async function up(db: Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      date_z TEXT NOT NULL,
      ...
    );
  `);
}

export async function down(db: Database): Promise<void> {
  await db.exec(`DROP TABLE IF EXISTS events;`);
}
```

#### Apply Migrations

```bash
# Run migrations
cd backend && npm run migrate

# Rollback last migration
cd backend && npm run migrate:rollback
```

---

## Monitoring & Logging

### Application Logging

#### Log Levels

- **DEBUG**: Verbose output (development only)
- **INFO**: General informational messages
- **WARN**: Warning messages (recoverable errors)
- **ERROR**: Error messages (failures)

#### Log Format

```json
{
  "timestamp": "2026-01-14T12:00:00.000Z",
  "level": "INFO",
  "service": "aviation-accident-tracker",
  "message": "Ingestion started for source: ASN",
  "metadata": {
    "source": "ASN",
    "year": 2024,
    "expected_events": 150
  }
}
```

#### Viewing Logs

**Local Development**:
```bash
# Follow logs
make logs

# Backend logs only
cd backend && npm run logs

# Frontend logs (browser console)
```

**Docker**:
```bash
# Follow all logs
docker-compose logs -f

# Follow backend logs only
docker-compose logs -f app
```

**Production (systemd)**:
```bash
# View logs
journalctl -u accident-tracker -f

# View last 100 lines
journalctl -u accident-tracker -n 100
```

### Health Checks

#### Health Endpoint

```bash
# Check application health
curl http://localhost:8080/api/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-14T12:00:00.000Z",
  "uptime": 3600,
  "database": "ok",
  "version": "1.0.0"
}
```

#### Database Health

```bash
# Check database connectivity
sqlite3 backend/data/accidents.db "SELECT COUNT(*) FROM events;"
```

### Monitoring Dashboards

#### Metrics to Monitor

1. **Application Metrics**:
   - Request rate (requests/second)
   - Response time (p50, p95, p99)
   - Error rate (5xx errors)
   - Active connections

2. **Database Metrics**:
   - Database size (MB)
   - Query execution time
   - Number of events
   - Ingestion rate

3. **System Metrics**:
   - CPU usage (%)
   - Memory usage (MB)
   - Disk usage (%)
   - Network I/O

#### Prometheus Integration

**prometheus.yml**:
```yaml
scrape_configs:
  - job_name: 'accident-tracker'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/api/metrics'
```

#### Grafana Dashboard

Import dashboard from `monitoring/grafana-dashboard.json` or create custom panels:

1. **Request Rate**: `rate(http_requests_total[5m])`
2. **Response Time**: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
3. **Error Rate**: `rate(http_requests_total{status=~"5.."}[5m])`

### Alerting

#### Alert Rules

**Prometheus Alerts** (`alerts.yml`):
```yaml
groups:
  - name: accident-tracker
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} req/s"
      
      - alert: SlowIngestion
        expr: ingestion_duration_seconds > 300
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Ingestion taking too long"
          description: "Ingestion duration: {{ $value }}s"
      
      - alert: DatabaseTooBig
        expr: database_size_bytes > 5e9  # 5GB
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Database size exceeded 5GB"
          description: "Current size: {{ $value | humanize }}"
```

---

## Ingestion Management

### Manual Ingestion

#### Full Ingestion

```bash
# Ingest from all sources for all years
cd backend && npm run ingest

# Ingest specific source
cd backend && npm run ingest -- --source=ASN

# Ingest specific year range
cd backend && npm run ingest -- --start-year=2024 --end-year=2024
```

#### Incremental Ingestion

```bash
# Ingest only new events (since last ingestion)
cd backend && npm run ingest -- --incremental
```

### Automated Ingestion

#### Cron Job Setup

```cron
# Daily ingestion at 3 AM
0 3 * * * cd /path/to/apps/aviation-accident-tracker/backend && npm run ingest -- --incremental >> /var/log/accident-tracker-ingest.log 2>&1
```

#### Systemd Timer

**accident-tracker-ingest.service**:
```ini
[Unit]
Description=Aviation Accident Tracker Ingestion
After=network.target

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/opt/aviation-accident-tracker/backend
ExecStart=/usr/bin/npm run ingest -- --incremental
StandardOutput=journal
StandardError=journal
```

**accident-tracker-ingest.timer**:
```ini
[Unit]
Description=Run accident tracker ingestion daily

[Timer]
OnCalendar=daily
OnCalendar=03:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable timer:
```bash
sudo systemctl enable accident-tracker-ingest.timer
sudo systemctl start accident-tracker-ingest.timer
```

### Ingestion Debugging

#### Check Ingestion Status

```bash
# View ingestion logs
tail -f /var/log/accident-tracker-ingest.log

# Check last ingestion time
sqlite3 backend/data/accidents.db "SELECT MAX(fetched_at_z) FROM events;"
```

#### Common Ingestion Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Network timeout** | Ingestion stops mid-process | Increase `INGEST_TIMEOUT_MS` |
| **Rate limiting** | 429 errors in logs | Add delay between requests |
| **Duplicate events** | Warnings about skipped events | Normal - deduplication working |
| **Missing events** | Fewer events than expected | Check source availability |
| **Slow ingestion** | Takes >30 minutes | Reduce `INGEST_BATCH_SIZE` |

### Rate Limit Configuration

#### Source-Specific Rate Limits

```typescript
// backend/src/ingest/config.ts
export const RATE_LIMITS = {
  ASN: {
    requestsPerSecond: 1,
    delayBetweenRequests: 1000 // ms
  },
  AVHerald: {
    requestsPerSecond: 2,
    delayBetweenRequests: 500 // ms
  }
};
```

#### Respect `robots.txt` and Source Terms

- **ASN**: 1 request/second
- **AVHerald**: 2 requests/second

Always check source terms of service before adjusting limits.

---

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

**Symptoms**: Service fails to start, exits immediately

**Diagnostic Steps**:
```bash
# Check logs
make logs

# Check if port is already in use
lsof -i :8080

# Verify Node.js version
node --version  # Should be 20+

# Check database file permissions
ls -la backend/data/accidents.db
```

**Solutions**:
- Kill process using port 8080: `kill -9 $(lsof -t -i :8080)`
- Fix permissions: `chmod 664 backend/data/accidents.db`
- Update Node.js: `nvm install 20 && nvm use 20`

#### 2. Database Locked

**Symptoms**: `SQLITE_BUSY: database is locked` errors

**Diagnostic Steps**:
```bash
# Check for active connections
lsof backend/data/accidents.db

# Check for WAL files
ls -la backend/data/accidents.db-*
```

**Solutions**:
- Stop all services accessing the database
- Wait for active transactions to complete
- Enable WAL mode for better concurrency:
  ```bash
  sqlite3 backend/data/accidents.db "PRAGMA journal_mode=WAL;"
  ```

#### 3. Ingestion Failures

**Symptoms**: Ingestion stops, incomplete data

**Diagnostic Steps**:
```bash
# Check ingestion logs
tail -f /var/log/accident-tracker-ingest.log

# Check network connectivity
curl -I https://aviation-safety.net

# Check database space
df -h backend/data/
```

**Solutions**:
- Retry with increased timeout: `npm run ingest -- --timeout=60000`
- Check source availability (may be temporarily down)
- Free disk space if needed
- Run incremental ingestion: `npm run ingest -- --incremental`

#### 4. High Memory Usage

**Symptoms**: Service crashes with out-of-memory errors

**Diagnostic Steps**:
```bash
# Check memory usage
ps aux | grep node

# Check Node.js heap size
node --v8-options | grep max_old_space_size
```

**Solutions**:
- Increase Node.js heap size:
  ```bash
  export NODE_OPTIONS="--max-old-space-size=2048"
  ```
- Reduce batch size: `INGEST_BATCH_SIZE=50`
- Restart service regularly during ingestion

#### 5. Slow API Responses

**Symptoms**: API requests take >5 seconds

**Diagnostic Steps**:
```bash
# Check database size
ls -lh backend/data/accidents.db

# Check query performance
sqlite3 backend/data/accidents.db "EXPLAIN QUERY PLAN SELECT * FROM events LIMIT 100;"

# Check for missing indexes
sqlite3 backend/data/accidents.db ".schema events"
```

**Solutions**:
- Run `VACUUM` to optimize database:
  ```bash
  sqlite3 backend/data/accidents.db "VACUUM;"
  ```
- Add indexes for common queries
- Enable query result caching
- Consider pagination with smaller page sizes

#### 6. Frontend Won't Load

**Symptoms**: White screen, 404 errors

**Diagnostic Steps**:
```bash
# Check if backend is running
curl http://localhost:8080/api/health

# Check frontend build
ls -la frontend/dist/

# Check browser console for errors
```

**Solutions**:
- Rebuild frontend: `cd frontend && npm run build`
- Check `VITE_API_BASE_URL` in `.env`
- Clear browser cache
- Ensure backend is accessible from frontend

### Performance Issues

#### Slow Database Queries

```sql
-- Enable query profiling
PRAGMA query_only = OFF;

-- Check indexes
SELECT * FROM sqlite_master WHERE type='index';

-- Analyze query plan
EXPLAIN QUERY PLAN SELECT * FROM events WHERE date_z >= '2024-01-01';
```

#### High CPU Usage

```bash
# Profile Node.js application
node --prof backend/dist/index.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

---

## Scaling

### Vertical Scaling

#### Resource Requirements

| Load Level | Events | RAM | CPU | Disk |
|------------|--------|-----|-----|------|
| **Small** | <10,000 | 512MB | 0.25 cores | 500MB |
| **Medium** | 10,000-50,000 | 1GB | 0.5 cores | 2GB |
| **Large** | 50,000-200,000 | 2GB | 1 core | 5GB |
| **Extra Large** | >200,000 | 4GB | 2 cores | 10GB |

#### Scaling Up

1. **Increase RAM**:
   ```bash
   # Docker
   docker run --memory=2g ...
   
   # Kubernetes
   kubectl set resources deployment accident-tracker --limits=memory=2Gi
   ```

2. **Increase CPU**:
   ```bash
   # Docker
   docker run --cpus=1.0 ...
   
   # Kubernetes
   kubectl set resources deployment accident-tracker --limits=cpu=1000m
   ```

3. **Increase Disk**:
   ```bash
   # Expand volume
   fly volumes extend accident_data --size 5
   ```

### Horizontal Scaling

**⚠️ Current Limitation**: SQLite is single-writer, limiting horizontal scaling.

#### Read Replicas (Future Enhancement)

1. **Master-Replica Setup**:
   - Single writer (master)
   - Multiple readers (replicas)
   - Use Litestream for replication

2. **Load Balancer**:
   - Route writes to master
   - Route reads to replicas

#### Migration to PostgreSQL (for true horizontal scaling)

If you need horizontal scaling, migrate to PostgreSQL:

1. Export data: `sqlite3 accidents.db .dump > export.sql`
2. Convert schema for PostgreSQL
3. Import to PostgreSQL
4. Update database connection in code
5. Deploy multiple instances behind load balancer

### Caching Strategy

#### In-Memory Cache

```typescript
// backend/src/cache/memory-cache.ts
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5-minute TTL

export function getCached<T>(key: string): T | undefined {
  return cache.get(key);
}

export function setCache<T>(key: string, value: T): void {
  cache.set(key, value);
}
```

#### Redis Cache (for multi-instance deployments)

```typescript
// backend/src/cache/redis-cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCached<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
}

export async function setCache<T>(key: string, value: T, ttl: number = 300): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttl);
}
```

---

## Disaster Recovery

### Recovery Time Objective (RTO)

**Target**: < 1 hour

### Recovery Point Objective (RPO)

**Target**: < 24 hours (daily backups)

### Disaster Recovery Plan

#### Scenario 1: Database Corruption

1. **Detect**: Health check fails, integrity check shows errors
2. **Assess**: Determine extent of corruption
3. **Recover**: Restore from most recent backup
4. **Verify**: Run integrity check on restored database
5. **Resume**: Restart services

**Commands**:
```bash
# Stop service
make stop-backend

# Restore from backup
gunzip -c backup/accidents_latest.db.gz > backend/data/accidents.db

# Verify
sqlite3 backend/data/accidents.db "PRAGMA integrity_check;"

# Restart
make start-backend
```

#### Scenario 2: Complete Data Loss

1. **Provision** new environment
2. **Deploy** application from Git
3. **Restore** database from off-site backup
4. **Run** full ingestion if no recent backup
5. **Verify** data completeness

**Commands**:
```bash
# Clone repository
git clone https://github.com/jordanhubbard/Aviation.git
cd Aviation/apps/aviation-accident-tracker

# Install and build
make install && make build

# Restore or ingest
# Option 1: Restore from backup
gunzip -c s3://backups/accidents_latest.db.gz > backend/data/accidents.db

# Option 2: Full ingestion (if no backup)
cd backend && npm run ingest

# Verify
sqlite3 backend/data/accidents.db "SELECT COUNT(*) FROM events;"

# Start service
make start-backend
```

#### Scenario 3: Service Outage

1. **Detect**: Health checks fail, 5xx errors
2. **Diagnose**: Check logs, system resources
3. **Restart**: Restart service or redeploy
4. **Verify**: Confirm service is healthy
5. **Investigate**: Root cause analysis

**Commands**:
```bash
# Quick restart
systemctl restart accident-tracker

# Or Docker
docker-compose restart

# Or Kubernetes
kubectl rollout restart deployment/accident-tracker

# Verify
curl http://localhost:8080/api/health
```

### Backup Strategy

#### Backup Schedule

- **Frequency**: Daily at 2 AM
- **Retention**: 7 days (local), 30 days (off-site)
- **Storage**: Local disk + S3/GCS

#### Off-Site Backup

```bash
# Upload to S3
aws s3 cp backup/accidents_20260114_020000.db.gz s3://my-backups/accident-tracker/

# Upload to Google Cloud Storage
gsutil cp backup/accidents_20260114_020000.db.gz gs://my-backups/accident-tracker/
```

#### Automated Backup Script with Off-Site

```bash
#!/bin/bash
# scripts/backup-with-offsite.sh

set -e

# Backup locally
./scripts/backup-database.sh

# Get latest backup
LATEST_BACKUP=$(ls -t backup/accidents_*.db.gz | head -1)

# Upload to S3
aws s3 cp "$LATEST_BACKUP" s3://my-backups/accident-tracker/

# Verify upload
aws s3 ls s3://my-backups/accident-tracker/

echo "Backup uploaded to S3: $LATEST_BACKUP"
```

---

## Security

### Authentication & Authorization

**Current State**: No authentication (read-only public data)

**Future Enhancement**:
- Add API key authentication for write operations
- Implement role-based access control (RBAC)
- Use JWT tokens for frontend authentication

### HTTPS/TLS

#### Enable HTTPS in Production

**nginx Configuration**:
```nginx
server {
    listen 443 ssl http2;
    server_name accident-tracker.example.com;
    
    ssl_certificate /etc/letsencrypt/live/accident-tracker.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/accident-tracker.example.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Security Best Practices

1. **Keep Dependencies Updated**:
   ```bash
   npm audit
   npm audit fix
   ```

2. **Use Environment Variables**:
   - Never commit secrets to Git
   - Use `.env` files (ignored in `.gitignore`)
   - Use secret management (AWS Secrets Manager, Vault)

3. **Implement Rate Limiting**:
   - Prevent abuse
   - Protect against DoS attacks
   - Already configured in `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`

4. **Input Validation**:
   - Validate all API inputs
   - Sanitize user input
   - Use parameterized SQL queries (already done with prepared statements)

5. **CORS Configuration**:
   ```typescript
   // backend/src/app.ts
   app.use(cors({
     origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
     methods: ['GET', 'POST'],
     credentials: true
   }));
   ```

---

## Performance Tuning

### Database Optimization

#### Indexes

```sql
-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date_z);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_country ON events(country);
CREATE INDEX IF NOT EXISTS idx_events_registration ON events(registration);
```

#### Query Optimization

```sql
-- Use EXPLAIN QUERY PLAN to analyze queries
EXPLAIN QUERY PLAN SELECT * FROM events WHERE date_z >= '2024-01-01' LIMIT 100;

-- Optimize with covering indexes
CREATE INDEX idx_events_date_category ON events(date_z, category);
```

#### WAL Mode

```bash
# Enable Write-Ahead Logging for better concurrency
sqlite3 backend/data/accidents.db "PRAGMA journal_mode=WAL;"
```

### API Optimization

#### Response Compression

```typescript
// backend/src/app.ts
import compression from 'compression';

app.use(compression());
```

#### Pagination

```typescript
// Always use LIMIT and OFFSET
app.get('/api/events', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
  const offset = (page - 1) * pageSize;
  
  const events = await repository.getEvents({ limit: pageSize, offset });
  res.json(events);
});
```

#### Caching Headers

```typescript
// Cache static responses
app.get('/api/events/:id', async (req, res) => {
  const event = await repository.getEventById(req.params.id);
  res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.json(event);
});
```

### Frontend Optimization

#### Code Splitting

```typescript
// frontend/src/App.tsx
import { lazy, Suspense } from 'react';

const MapView = lazy(() => import('./components/MapView'));
const TableView = lazy(() => import('./components/TableView'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MapView />
      <TableView />
    </Suspense>
  );
}
```

#### Lazy Loading Images

```typescript
// Use lazy loading for images
<img src={imageUrl} loading="lazy" alt="..." />
```

---

## Support & Contacts

### Getting Help

1. **Documentation**: Check this guide and [README.md](README.md)
2. **Issues**: Open a GitHub issue
3. **Discussions**: GitHub Discussions

### Useful Links

- **Repository**: https://github.com/jordanhubbard/Aviation
- **CI/CD**: GitHub Actions
- **Dependencies**: Dependabot (automated security updates)

---

## Appendix

### Useful Commands

```bash
# Development
make dev                  # Start both backend and frontend
make test                 # Run all tests
make build                # Build both backend and frontend

# Backend
make start-backend        # Start backend service
make stop-backend         # Stop backend service
make logs-backend         # View backend logs

# Frontend
make start-frontend       # Start frontend dev server
make build-frontend       # Build frontend for production

# Database
make backup-db            # Backup database
make restore-db           # Restore database

# Docker
make docker-up            # Start with Docker Compose
make docker-down          # Stop Docker Compose
make docker-logs          # View Docker logs

# Ingestion
make ingest               # Run full ingestion
make ingest-incremental   # Run incremental ingestion
```

### Monitoring Checklist

- [ ] Health endpoint responding: `/api/health`
- [ ] Logs are being written and rotated
- [ ] Database backups are running daily
- [ ] Disk space is sufficient (>20% free)
- [ ] Memory usage is within limits (<80%)
- [ ] API response times are acceptable (<2s p95)
- [ ] Ingestion is running on schedule
- [ ] No error spikes in logs

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-14  
**Maintainer**: Aviation Team
