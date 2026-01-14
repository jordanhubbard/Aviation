# Aviation Accident Tracker - Deployment Plan

**Version:** 1.0  
**Date:** 2026-01-13  
**Status:** Production Deployment Strategy  
**Target Environment:** Production, Staging, Development

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Setup](#environment-setup)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Deployment Strategy](#deployment-strategy)
5. [Monitoring & Observability](#monitoring--observability)
6. [Security](#security)
7. [Backup & Recovery](#backup--recovery)
8. [Rollback Procedures](#rollback-procedures)
9. [Operational Runbook](#operational-runbook)

---

## Overview

### Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer / CDN                     │
│                    (Cloudflare / nginx)                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
       ┌───────────┴────────────┐
       │                        │
       ▼                        ▼
┌─────────────┐          ┌─────────────┐
│  Frontend   │          │  Frontend   │
│  (Vite App) │          │  (Replica)  │
│  Port 3000  │          │  Port 3001  │
└──────┬──────┘          └──────┬──────┘
       │                        │
       └────────┬───────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                             │
│                  (Backend Express)                          │
│                    Port 8080                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
       ┌───────────┼────────────┐
       │           │            │
       ▼           ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ SQLite   │ │ ASN API  │ │ AVHerald │
│ Database │ │          │ │   API    │
└──────────┘ └──────────┘ └──────────┘
```

---

## Environment Setup

### 1. Development Environment

**Purpose:** Local development and testing

**Requirements:**
- Node.js 20+
- Python 3.11+ (optional, for shared SDK Python wrappers)
- SQLite 3
- Git

**Setup:**
```bash
# Clone repository
git clone https://github.com/your-org/Aviation.git
cd Aviation/apps/aviation-accident-tracker

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with local configuration

# Initialize database
npm run db:init

# Seed database (optional)
npm run seed:dev

# Start development servers
npm run dev          # Frontend (port 3000)
npm run dev:backend  # Backend (port 8080)
```

**Environment Variables (.env):**
```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug

# Database
DATABASE_PATH=./data/events.db

# API
API_PORT=8080
CORS_ORIGIN=http://localhost:3000

# Ingestion
INGESTION_TOKEN=dev-token
INGESTION_SCHEDULE=0 */6 * * *  # Every 6 hours

# External APIs (optional for dev)
OPENWEATHERMAP_API_KEY=your_key_here  # From keystore
```

---

### 2. Staging Environment

**Purpose:** Pre-production validation

**Infrastructure:**
- Single VM or container
- Public URL: https://staging-accidents.aviation.example.com
- SSL/TLS certificate
- Firewall rules

**Setup:**
```bash
# On staging server
git clone https://github.com/your-org/Aviation.git
cd Aviation/apps/aviation-accident-tracker

# Install dependencies
npm ci --production

# Build frontend
cd frontend && npm run build

# Build backend
cd ../backend && npm run build

# Set up environment variables
cp .env.staging .env
# Edit with staging configuration

# Set up systemd service
sudo cp deploy/accident-tracker-staging.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable accident-tracker-staging
sudo systemctl start accident-tracker-staging
```

**Environment Variables (.env.staging):**
```bash
NODE_ENV=staging
LOG_LEVEL=info

DATABASE_PATH=/var/lib/accident-tracker/staging/events.db

API_PORT=8080
CORS_ORIGIN=https://staging-accidents.aviation.example.com

INGESTION_TOKEN=$STAGING_INGESTION_TOKEN  # From secrets manager
INGESTION_SCHEDULE=0 */4 * * *  # Every 4 hours

# From keystore
KEYSTORE_ENCRYPTION_KEY=$STAGING_KEYSTORE_KEY
```

---

### 3. Production Environment

**Purpose:** Live production deployment

**Infrastructure:**
- Multi-region deployment (optional)
- Load balancer
- Auto-scaling (optional)
- CDN for static assets
- SSL/TLS certificate
- Firewall rules
- DDoS protection

**Recommended Hosting:**
- **Option A:** Docker containers on AWS ECS / Azure Container Instances
- **Option B:** VM on DigitalOcean / Linode / Hetzner
- **Option C:** Kubernetes cluster (overkill for MVP)

**Setup:**
```bash
# Use CI/CD for production deployments (see below)
# Manual deployment NOT recommended

# If manual deployment required:
git clone https://github.com/your-org/Aviation.git
cd Aviation/apps/aviation-accident-tracker

npm ci --production
cd frontend && npm run build
cd ../backend && npm run build

# Configure production environment
cp deploy/.env.production .env
# Edit with production secrets (use secrets manager)

# Set up systemd service
sudo cp deploy/accident-tracker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable accident-tracker
sudo systemctl start accident-tracker
```

**Environment Variables (.env.production):**
```bash
NODE_ENV=production
LOG_LEVEL=warn

DATABASE_PATH=/var/lib/accident-tracker/production/events.db

API_PORT=8080
CORS_ORIGIN=https://accidents.aviation.example.com

INGESTION_TOKEN=$PRODUCTION_INGESTION_TOKEN  # From secrets manager
INGESTION_SCHEDULE=0 */2 * * *  # Every 2 hours

# From keystore
KEYSTORE_ENCRYPTION_KEY=$PRODUCTION_KEYSTORE_KEY

# Monitoring
SENTRY_DSN=$SENTRY_DSN  # Error tracking
NEW_RELIC_LICENSE_KEY=$NEW_RELIC_KEY  # APM (optional)
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**File:** `.github/workflows/deploy-accident-tracker.yml`

```yaml
name: Deploy Aviation Accident Tracker

on:
  push:
    branches:
      - main
      - staging
    paths:
      - 'apps/aviation-accident-tracker/**'
      - 'packages/shared-sdk/**'
      - 'packages/ui-framework/**'
  pull_request:
    paths:
      - 'apps/aviation-accident-tracker/**'

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
        working-directory: apps/aviation-accident-tracker
      
      - name: Run tests
        run: npm test
        working-directory: apps/aviation-accident-tracker
      
      - name: Run integration tests
        run: npm run test:integration
        working-directory: apps/aviation-accident-tracker
      
      - name: Build frontend
        run: npm run build
        working-directory: apps/aviation-accident-tracker/frontend
      
      - name: Build backend
        run: npm run build
        working-directory: apps/aviation-accident-tracker/backend

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: 'apps/aviation-accident-tracker'
          severity: 'CRITICAL,HIGH'
      
      - name: Run npm audit
        run: npm audit --audit-level=high
        working-directory: apps/aviation-accident-tracker

  deploy-staging:
    name: Deploy to Staging
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to staging server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/aviation/apps/aviation-accident-tracker
            git pull origin staging
            npm ci --production
            cd frontend && npm run build && cd ..
            cd backend && npm run build && cd ..
            sudo systemctl restart accident-tracker-staging

  deploy-production:
    name: Deploy to Production
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: |
          docker build -t aviation-accident-tracker:${{ github.sha }} .
          docker tag aviation-accident-tracker:${{ github.sha }} aviation-accident-tracker:latest
        working-directory: apps/aviation-accident-tracker
      
      - name: Push to registry
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker push aviation-accident-tracker:${{ github.sha }}
          docker push aviation-accident-tracker:latest
      
      - name: Deploy to production
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            cd /opt/aviation/apps/aviation-accident-tracker
            docker pull aviation-accident-tracker:${{ github.sha }}
            docker-compose up -d --no-deps accident-tracker
            docker system prune -f

  notify:
    name: Notify Deployment
    needs: [deploy-production]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Aviation Accident Tracker deployed to production'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Deployment Strategy

### Rolling Deployment (Recommended)

**Benefits:**
- Zero downtime
- Gradual rollout
- Easy rollback

**Process:**
1. Deploy to 50% of instances
2. Health check
3. Deploy to remaining 50%
4. Monitor for issues

**Implementation:**
```bash
# Deploy script
#!/bin/bash
set -e

INSTANCES=("server1" "server2")
NEW_VERSION=$1

for INSTANCE in "${INSTANCES[@]}"; do
  echo "Deploying to $INSTANCE..."
  
  ssh $INSTANCE "
    cd /opt/aviation/apps/aviation-accident-tracker
    git fetch origin
    git checkout $NEW_VERSION
    npm ci --production
    npm run build
    sudo systemctl restart accident-tracker
  "
  
  # Health check
  sleep 10
  curl -f "https://$INSTANCE.example.com/health" || {
    echo "Health check failed for $INSTANCE"
    exit 1
  }
  
  echo "$INSTANCE deployed successfully"
done

echo "Deployment complete!"
```

---

### Blue-Green Deployment (Alternative)

**Benefits:**
- Instant rollback
- Full environment testing
- No downtime

**Process:**
1. Deploy to "green" environment
2. Test green environment
3. Switch traffic to green
4. Keep blue as fallback

**Implementation:**
```bash
# Blue-green switch
#!/bin/bash

BLUE_URL="https://blue.accidents.example.com"
GREEN_URL="https://green.accidents.example.com"
PROD_URL="https://accidents.example.com"

# Deploy to green
echo "Deploying to green environment..."
ssh green-server "cd /opt/aviation && git pull && npm run deploy"

# Test green
echo "Testing green environment..."
curl -f "$GREEN_URL/health" || { echo "Green health check failed"; exit 1; }

# Switch traffic
echo "Switching traffic to green..."
# Update load balancer or DNS

echo "Deployment complete. Blue environment kept as fallback."
```

---

## Monitoring & Observability

### 1. Application Monitoring

**Tools:**
- **Sentry:** Error tracking and crash reporting
- **New Relic / DataDog:** APM and performance monitoring (optional)
- **Prometheus + Grafana:** Metrics and dashboards (optional)

**Setup:**
```typescript
// Backend: src/monitoring.ts
import * as Sentry from '@sentry/node';

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

export function captureException(error: Error, context?: any) {
  console.error('Error:', error, context);
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, { extra: context });
  }
}
```

---

### 2. Health Checks

**Endpoints:**
- `GET /health` - Liveness probe
- `GET /health/ready` - Readiness probe

**Implementation:**
```typescript
// Backend: src/api/health.ts
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  });
});

router.get('/health/ready', async (req, res) => {
  try {
    // Check database
    await repository.healthCheck();
    
    res.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      error: error.message
    });
  }
});
```

---

### 3. Logging

**Strategy:**
- Structured JSON logging
- Log levels: ERROR, WARN, INFO, DEBUG
- Log aggregation (optional): Loki, ELK stack

**Implementation:**
```typescript
// Backend: src/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

---

### 4. Metrics

**Key Metrics:**
- Request rate (requests/sec)
- Response time (p50, p95, p99)
- Error rate (%)
- Database query time
- Ingestion success rate

**Implementation:**
```typescript
// Backend: src/metrics.ts
import { Registry, Counter, Histogram } from 'prom-client';

export const register = new Registry();

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

// Expose metrics
router.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

---

## Security

### 1. HTTPS/TLS

**Requirements:**
- Valid SSL/TLS certificate
- HTTPS only (redirect HTTP to HTTPS)
- TLS 1.2+
- Strong cipher suites

**nginx Configuration:**
```nginx
server {
    listen 80;
    server_name accidents.aviation.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name accidents.aviation.example.com;

    ssl_certificate /etc/letsencrypt/live/accidents.aviation.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/accidents.aviation.example.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### 2. API Security

**Measures:**
- Rate limiting
- CORS configuration
- Input validation
- SQL injection prevention (parameterized queries)
- XSS prevention (React escapes by default)

**Rate Limiting:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api', limiter);

// Stricter limit for ingestion endpoint
const ingestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Ingestion rate limit exceeded'
});

app.use('/api/ingest', ingestLimiter);
```

---

### 3. Secrets Management

**Never commit secrets!**

**Use:**
- Environment variables
- Keystore (for API keys)
- Secrets manager (AWS Secrets Manager, HashiCorp Vault)

**Production Setup:**
```bash
# Store secrets in secrets manager
aws secretsmanager create-secret \
  --name aviation/accident-tracker/production \
  --secret-string '{"INGESTION_TOKEN":"xxx","KEYSTORE_KEY":"yyy"}'

# Retrieve in deploy script
aws secretsmanager get-secret-value \
  --secret-id aviation/accident-tracker/production \
  --query SecretString \
  --output text > .env
```

---

## Backup & Recovery

### 1. Database Backup

**Strategy:**
- Automated daily backups
- Retention: 30 days
- Off-site storage

**Backup Script:**
```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
DB_PATH="/var/lib/accident-tracker/production/events.db"
BACKUP_DIR="/var/backups/accident-tracker"
S3_BUCKET="s3://aviation-backups/accident-tracker"

# Create backup
mkdir -p $BACKUP_DIR
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/events_$DATE.db'"

# Compress
gzip "$BACKUP_DIR/events_$DATE.db"

# Upload to S3
aws s3 cp "$BACKUP_DIR/events_$DATE.db.gz" "$S3_BUCKET/daily/"

# Clean up old backups (keep 30 days)
find $BACKUP_DIR -name "events_*.db.gz" -mtime +30 -delete

echo "Backup complete: events_$DATE.db.gz"
```

**Cron Job:**
```cron
# Run daily at 2 AM
0 2 * * * /opt/aviation/scripts/backup-db.sh >> /var/log/backup.log 2>&1
```

---

### 2. Disaster Recovery

**Recovery Time Objective (RTO):** < 1 hour  
**Recovery Point Objective (RPO):** < 24 hours

**Recovery Process:**
1. Provision new server
2. Install application
3. Restore latest database backup
4. Update DNS/load balancer
5. Validate functionality

**Recovery Script:**
```bash
#!/bin/bash
# recover-db.sh

BACKUP_FILE=$1
DB_PATH="/var/lib/accident-tracker/production/events.db"

# Download backup from S3
aws s3 cp "$S3_BUCKET/daily/$BACKUP_FILE" /tmp/

# Decompress
gunzip "/tmp/$BACKUP_FILE"

# Restore
cp "/tmp/${BACKUP_FILE%.gz}" $DB_PATH

# Verify
sqlite3 $DB_PATH "PRAGMA integrity_check;"

echo "Recovery complete"
```

---

## Rollback Procedures

### Automatic Rollback

**Triggers:**
- Health check failure
- Error rate >5%
- Response time >5s (p95)

**Process:**
1. Detect issue (monitoring)
2. Stop new deployments
3. Revert to previous version
4. Verify health checks pass
5. Notify team

**Script:**
```bash
#!/bin/bash
# rollback.sh

PREVIOUS_VERSION=$(git describe --abbrev=0 --tags HEAD^)

echo "Rolling back to $PREVIOUS_VERSION..."

# Checkout previous version
git checkout $PREVIOUS_VERSION

# Rebuild and restart
npm ci --production
npm run build
sudo systemctl restart accident-tracker

# Health check
sleep 10
curl -f "https://accidents.aviation.example.com/health" || {
  echo "Rollback health check failed!"
  exit 1
}

echo "Rollback complete to $PREVIOUS_VERSION"
```

---

### Manual Rollback

**Steps:**
1. Identify the version to rollback to
2. Run rollback script or redeploy previous version
3. Verify in staging first (if possible)
4. Monitor metrics closely
5. Document incident

**Commands:**
```bash
# List recent versions
git tag -l --sort=-version:refname | head -5

# Rollback to specific version
./deploy/rollback.sh v1.2.3

# Or using Docker
docker-compose down
docker pull aviation-accident-tracker:v1.2.3
docker-compose up -d
```

---

## Operational Runbook

### Common Tasks

#### 1. Deploy New Version

```bash
# Via CI/CD (recommended)
git tag v1.3.0
git push origin v1.3.0

# Manual (emergency only)
ssh production-server
cd /opt/aviation/apps/aviation-accident-tracker
git pull origin main
npm ci --production
npm run build
sudo systemctl restart accident-tracker
```

---

#### 2. Check Application Health

```bash
# Health endpoint
curl https://accidents.aviation.example.com/health

# Check logs
ssh production-server
tail -f /var/log/accident-tracker/combined.log

# Check service status
sudo systemctl status accident-tracker
```

---

#### 3. Trigger Manual Ingestion

```bash
curl -X POST https://accidents.aviation.example.com/api/ingest/run \
  -H "Authorization: Bearer $INGESTION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 7}'
```

---

#### 4. Database Maintenance

```bash
# Check database size
du -h /var/lib/accident-tracker/production/events.db

# Vacuum database (reclaim space)
sqlite3 /var/lib/accident-tracker/production/events.db "VACUUM;"

# Check integrity
sqlite3 /var/lib/accident-tracker/production/events.db "PRAGMA integrity_check;"
```

---

#### 5. View Logs

```bash
# Application logs
tail -f /var/log/accident-tracker/combined.log

# Error logs only
tail -f /var/log/accident-tracker/error.log

# System logs
journalctl -u accident-tracker -f

# Search logs
grep "ERROR" /var/log/accident-tracker/combined.log | tail -20
```

---

### Incident Response

#### High Error Rate

**Symptoms:** Error rate >5%, 5xx responses

**Actions:**
1. Check logs for error patterns
2. Check external API status (ASN, AVHerald)
3. Check database connectivity
4. Consider rollback if recent deployment
5. Scale up if capacity issue

---

#### Database Locked

**Symptoms:** "Database locked" errors

**Actions:**
1. Check for long-running queries
2. Restart application
3. Check disk space
4. Optimize queries if needed

---

#### High Memory Usage

**Symptoms:** Memory >80%, OOM kills

**Actions:**
1. Check for memory leaks
2. Restart application
3. Increase memory limit
4. Optimize data processing

---

## Checklist: Pre-Deployment

- [ ] All tests passing (unit, integration, E2E)
- [ ] Security scan passed
- [ ] Database migrations tested
- [ ] Secrets configured
- [ ] Monitoring enabled
- [ ] Backups verified
- [ ] Rollback plan ready
- [ ] Team notified
- [ ] Documentation updated

---

## Checklist: Post-Deployment

- [ ] Health checks passing
- [ ] Error rate normal (<1%)
- [ ] Response times acceptable (<500ms p95)
- [ ] Ingestion working
- [ ] Frontend rendering correctly
- [ ] Database queries optimized
- [ ] Logs clean (no unexpected errors)
- [ ] Monitoring dashboards green
- [ ] Team notified of completion

---

## Support Contacts

**On-Call Rotation:** See PagerDuty schedule  
**Escalation Path:**
1. On-call engineer
2. Team lead
3. Engineering manager

**External Support:**
- ASN: Check https://aviation-safety.net/
- AVHerald: Check https://avherald.com/

---

**Last Updated:** 2026-01-13  
**Version:** 1.0  
**Owner:** Aviation Platform Team
