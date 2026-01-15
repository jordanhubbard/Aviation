# Aviation Accident Tracker - Production Deployment Guide

**Version:** 1.0.0  
**Last Updated:** January 15, 2026

This guide provides comprehensive instructions for deploying the Aviation Accident Tracker to production.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
- [Railway Deployment (Recommended)](#railway-deployment-recommended)
- [Fly.io Deployment](#flyio-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Post-Deployment](#post-deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Application Requirements

- ✅ OpenAPI documentation complete
- ✅ Scheduled ingestion implemented
- ✅ Frontend tests complete (30+ tests)
- ✅ Backend validated
- ✅ Docker images built
- ✅ CI/CD pipeline configured

### Production Secrets

You'll need these secrets configured:

| Secret | Description | Example |
|--------|-------------|---------|
| `ADMIN_TOKEN` | Admin API access token | `admin-secret-token-here` |
| `ASN_USER` | Aviation Safety Network username | `your-asn-username` |
| `ASN_PASS` | Aviation Safety Network password | `your-asn-password` |
| `AVHERALD_KEY` | AVHerald API key (if available) | `your-avherald-key` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/accidents` |

---

## Deployment Options

### Option 1: Railway (Recommended)

**Pros:**
- Simple deployment process
- Automatic SSL certificates
- Built-in PostgreSQL
- Easy environment variable management
- Free tier available

**Cons:**
- Limited customization
- Resource constraints on free tier

### Option 2: Fly.io

**Pros:**
- Global edge deployment
- Custom domains
- Good performance
- Reasonable pricing

**Cons:**
- More complex configuration
- Requires CLI tool

### Option 3: Kubernetes

**Pros:**
- Full control
- Enterprise-grade scaling
- Best for high-traffic scenarios

**Cons:**
- Most complex setup
- Higher operational overhead
- More expensive

---

## Railway Deployment (Recommended)

### 1. Install Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

### 2. Initialize Project

```bash
cd apps/aviation-accident-tracker

# Create new Railway project
railway init

# Link to existing project (if already created)
railway link
```

### 3. Add PostgreSQL Database

```bash
# Add PostgreSQL service
railway add --database postgresql

# Get database URL
railway variables --service postgresql
```

### 4. Configure Environment Variables

```bash
# Set production environment variables
railway variables set ADMIN_TOKEN="your-admin-token-here"
railway variables set ASN_USER="your-asn-username"
railway variables set ASN_PASS="your-asn-password"
railway variables set NODE_ENV="production"
railway variables set PORT="3002"

# Database URL is automatically set by Railway
```

### 5. Deploy Backend

```bash
# Deploy backend
cd backend
railway up

# Check deployment status
railway status

# View logs
railway logs
```

### 6. Deploy Frontend

```bash
# Deploy frontend (separate service)
cd ../frontend
railway up --service frontend

# Custom domain (optional)
railway domain
```

### 7. Set Up Scheduled Ingestion

Create a Railway cron service or use GitHub Actions:

**.github/workflows/scheduled-ingestion.yml:**
```yaml
name: Scheduled Ingestion

on:
  schedule:
    # Run every 6 hours
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger ingestion
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.ADMIN_TOKEN }}" \
            https://your-app.railway.app/api/v1/ingest/asn
```

### 8. Verify Deployment

```bash
# Health check
curl https://your-app.railway.app/health

# API check
curl https://your-app.railway.app/api/v1/events?limit=5
```

---

## Fly.io Deployment

### 1. Install Fly CLI

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login
```

### 2. Initialize App

```bash
cd apps/aviation-accident-tracker/backend

# Create Fly app
flyctl launch --name accident-tracker

# Add PostgreSQL
flyctl postgres create --name accident-tracker-db
flyctl postgres attach --app accident-tracker accident-tracker-db
```

### 3. Configure Secrets

```bash
# Set secrets
flyctl secrets set ADMIN_TOKEN="your-admin-token"
flyctl secrets set ASN_USER="your-asn-username"
flyctl secrets set ASN_PASS="your-asn-password"
flyctl secrets set NODE_ENV="production"
```

### 4. Deploy

```bash
# Deploy
flyctl deploy

# View status
flyctl status

# View logs
flyctl logs
```

### 5. Configure Custom Domain

```bash
# Add custom domain
flyctl certs create accident-tracker.yourdomain.com

# Verify DNS
flyctl certs check accident-tracker.yourdomain.com
```

---

## Kubernetes Deployment

Use the pre-configured Kubernetes manifests:

### 1. Apply Manifests

```bash
# Create namespace
kubectl apply -f k8s/base/namespace.yaml

# Apply all accident-tracker manifests
kubectl apply -f k8s/accident-tracker/

# Verify deployment
kubectl -n aviation get pods
kubectl -n aviation get services
kubectl -n aviation get ingress
```

### 2. Configure Secrets

```bash
# Create secrets from file
kubectl create secret generic accident-tracker-secrets \
  --from-literal=admin-token="your-admin-token" \
  --from-literal=asn-user="your-asn-username" \
  --from-literal=asn-pass="your-asn-password" \
  -n aviation
```

### 3. Set Up Ingress

Update the ingress hostname in `k8s/accident-tracker/deployment.yaml`:

```yaml
spec:
  rules:
  - host: accident-tracker.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: accident-tracker-backend
            port:
              name: http
```

### 4. Configure Let's Encrypt SSL

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Certificate will be automatically issued via ingress annotation
```

---

## Post-Deployment

### 1. Verify Application

```bash
# Health check
curl https://your-domain.com/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-01-15T10:00:00Z",
#   "version": "1.0.0"
# }
```

### 2. Test API Endpoints

```bash
# List events (public)
curl https://your-domain.com/api/v1/events?limit=5

# Statistics
curl https://your-domain.com/api/v1/statistics?groupBy=category

# Admin endpoint (requires token)
curl -H "Authorization: Bearer your-admin-token" \
  https://your-domain.com/api/v1/ingest/asn
```

### 3. Configure DNS

Update your DNS records to point to your deployment:

**Railway:**
```
CNAME accident-tracker your-app.railway.app
```

**Fly.io:**
```
CNAME accident-tracker your-app.fly.dev
```

**Kubernetes:**
```
A accident-tracker <INGRESS_IP>
```

### 4. Set Up Monitoring

#### Add to Grafana

1. Import accident-tracker dashboard (see `monitoring/grafana/dashboards/`)
2. Configure alerts for:
   - High error rates
   - Slow response times
   - Failed ingestion jobs

#### Configure Alerts

```yaml
# Example alert (Prometheus)
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value }} errors/sec"
```

### 5. Enable Auto-Scaling (Production)

**Railway:**
Auto-scaling is handled automatically.

**Fly.io:**
```bash
flyctl scale count 2 --max 10
flyctl autoscale set min=2 max=10
```

**Kubernetes:**
Already configured via HorizontalPodAutoscaler in manifests.

---

## Monitoring

### Application Metrics

Monitor these key metrics:

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Response time (p95) | < 200ms | > 500ms |
| Error rate | < 1% | > 5% |
| Availability | 99.9% | < 99% |
| Database query time | < 50ms | > 200ms |
| Ingestion success rate | > 95% | < 90% |

### Grafana Dashboards

Import pre-configured dashboards:

1. **System Overview:** `monitoring/grafana/dashboards/system.json`
2. **Application Metrics:** `monitoring/grafana/dashboards/app.json`
3. **Database Performance:** `monitoring/grafana/dashboards/db.json`

### Log Aggregation

Logs are automatically collected by:
- **Railway:** Built-in logging
- **Fly.io:** `flyctl logs` command
- **Kubernetes:** Loki + Promtail stack

---

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

**Symptom:** Deployment fails immediately  
**Causes:**
- Missing environment variables
- Database connection failed
- Port conflict

**Solution:**
```bash
# Check logs
railway logs           # Railway
flyctl logs            # Fly.io
kubectl logs POD_NAME  # Kubernetes

# Verify environment variables
railway variables  # Railway
flyctl secrets list  # Fly.io
kubectl get secrets  # Kubernetes
```

#### 2. High Memory Usage

**Symptom:** Application crashes with OOM errors  
**Causes:**
- SQLite database too large
- Memory leaks
- Too many concurrent requests

**Solution:**
```bash
# Increase memory limits (Railway)
railway restart --memory 2G

# Scale up (Fly.io)
flyctl scale memory 2048

# Update resources (Kubernetes)
kubectl edit deployment accident-tracker-backend -n aviation
```

#### 3. Database Connection Errors

**Symptom:** 500 errors, "Database locked" messages  
**Causes:**
- SQLite concurrent write issues
- Connection pool exhausted

**Solution:**
Migrate to PostgreSQL for production:

```typescript
// Update src/db/index.ts to use PostgreSQL
import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
```

#### 4. Slow API Responses

**Symptom:** Response times > 1s  
**Causes:**
- Missing database indexes
- N+1 query problems
- No caching

**Solution:**
```sql
-- Add indexes
CREATE INDEX idx_events_date ON events(date_z);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_country ON events(country);

-- Enable query caching
-- See docs/CACHE.md
```

### Getting Help

- **GitHub Issues:** https://github.com/aviation/monorepo/issues
- **Documentation:** https://docs.aviation.example.com
- **Support Email:** support@aviation.example.com

---

## Production Checklist

Before going live, verify:

- [ ] SSL/HTTPS enabled
- [ ] Database backed up
- [ ] Environment variables set
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] API documentation published
- [ ] Rate limiting enabled
- [ ] Scheduled ingestion working
- [ ] DNS configured
- [ ] Custom domain working
- [ ] Performance tested
- [ ] Security audit complete
- [ ] Team trained on operations

---

## Maintenance

### Daily Tasks
- Check error logs
- Verify scheduled ingestion ran successfully
- Monitor API usage metrics

### Weekly Tasks
- Review performance metrics
- Check database size and growth
- Update dependencies if needed

### Monthly Tasks
- Database backup verification
- Security patches
- Performance optimization review
- Cost analysis and optimization

---

**Last Updated:** January 15, 2026  
**Maintained by:** Aviation Monorepo Team  
**Production URL:** https://accident-tracker.aviation.example.com
