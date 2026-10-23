# Railway Deployment Guide for Aviation Monorepo

**Epic:** Aviation-1qg (P0)  
**Story:** Aviation-1qg.3 (Configure Railway for monorepo)  
**Date:** January 15, 2026  
**Railway Project:** https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd

---

## 🎯 Overview

This guide explains how to deploy all 7 aviation applications from this monorepo to Railway.com. Railway supports monorepo deployments using service-specific configuration.

---

## 📊 Current Deployment Status

### Deployed (3 apps - all sleeping)

1. **aviation-missions-app** - No warnings ✅
2. **flight-planner** - 2 warnings ⚠️⚠️
3. **foreflight-dashboard** - 4 warnings ⚠️⚠️⚠️⚠️

### Not Deployed (4 apps)

4. **aviation-accident-tracker** - New, needs deployment
5. **flight-tracker** - New, needs deployment
6. **flightschool** - New, needs deployment
7. **weather-briefing** - New, needs deployment

---

## 🚀 Railway CLI Setup

### 1. Install Railway CLI

Railway CLI is already installed: `railway 4.15.1`

### 2. Login to Railway

```bash
railway login
```

This will open a browser for authentication.

### 3. Link to Existing Project

```bash
cd /Users/jkh/Src/Aviation
railway link
```

Select the project: `practical-transformation` (or the project ID)

---

## 📦 Monorepo Deployment Strategy

Railway supports two approaches for monorepo deployments:

### Option A: Root Path Configuration (Recommended)

Each service is configured with a specific root directory in Railway dashboard:

1. Go to Railway dashboard: https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd
2. For each service, set **"Root Directory"** to the app path
   - Example: `apps/aviation-accident-tracker`
3. Railway will automatically detect `Dockerfile` or build configuration in that directory

### Option B: Separate Git Branches (Not Recommended)

Create separate branches for each app and deploy from those branches. This is more complex and harder to maintain.

---

## 🔧 Per-Service Configuration

### Service Configuration Pattern

For each application, Railway needs:

1. **Root Directory**: Path to the app (e.g., `apps/aviation-accident-tracker`)
2. **Build Command**: Usually auto-detected from `Dockerfile` or `package.json`
3. **Start Command**: Usually auto-detected from `Dockerfile` or `package.json`
4. **Environment Variables**: App-specific secrets and configuration
5. **Port**: Internal port the service listens on
6. **Health Check**: Optional but recommended

---

## 📋 Application-Specific Configuration

### 1. Aviation Missions App (Clojure)

**Status:** ✅ Deployed  
**Port:** 3000  
**Root Directory:** `apps/aviation-missions-app`

#### Railway Configuration

```yaml
# railway.toml (if needed)
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "java -jar target/uberjar/aviation-missions-standalone.jar"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

#### Environment Variables

```bash
# Set in Railway dashboard
ENVIRONMENT=production
API_PORT=3000
DATABASE_URL=./data/aviation-missions
```

#### Verification

```bash
cd apps/aviation-missions-app
railway status
railway logs
```

---

### 2. FlightPlanner (Python + React)

**Status:** ✅ Deployed (2 warnings)  
**Ports:** 5051 (FastAPI), 3001 (React dev)  
**Root Directory:** `apps/flight-planner`

#### Railway Configuration

```yaml
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 100
```

#### Environment Variables

```bash
# Required
OPENWEATHERMAP_API_KEY=<your-key>
SECRET_KEY=<random-secret>

# Optional
OPENTOPO_API_KEY=<your-key>
DATABASE_URL=sqlite:///./data/flight-planner.db
```

#### Investigate Warnings

```bash
cd apps/flight-planner
railway logs --tail 100
# Look for warnings about:
# - Missing environment variables
# - Database migration issues
# - API key configuration
# - Build warnings
```

---

### 3. ForeFlight Dashboard (Python + React)

**Status:** ✅ Deployed (4 warnings)  
**Ports:** 5051 (FastAPI), 3001 (React dev)  
**Root Directory:** `apps/foreflight-dashboard`

#### Railway Configuration

```yaml
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 100
```

#### Environment Variables

```bash
# Required
SECRET_KEY=<random-secret>
DATABASE_URL=sqlite:///./data/foreflight.db

# Optional
OPENWEATHERMAP_API_KEY=<your-key>
```

#### Investigate Warnings

```bash
cd apps/foreflight-dashboard
railway logs --tail 100
# Look for warnings about:
# - File upload directory permissions
# - CSV parsing issues
# - Database migration issues
# - Frontend build warnings
```

---

### 4. Aviation Accident Tracker (TypeScript + React)

**Status:** 🆕 Not deployed  
**Ports:** 3002 (Express + GraphQL), 5173 (Vite dev)  
**Root Directory:** `apps/aviation-accident-tracker`

#### Deployment Steps

```bash
cd apps/aviation-accident-tracker

# Add service to Railway project
railway add --name accident-tracker

# Set root directory in Railway dashboard
# Set to: apps/aviation-accident-tracker

# Deploy
railway up
```

#### Railway Configuration

```yaml
# railway.toml (create if needed)
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 100
```

#### Environment Variables

```bash
# Required
NODE_ENV=production
BACKEND_PORT=3002
DATABASE_PATH=/app/data/accidents.db

# Optional
LOG_LEVEL=info
INGESTION_CRON=0 0 * * *  # Daily at midnight
```

---

### 5. Flight Tracker (TypeScript)

**Status:** 🆕 Not deployed  
**Port:** 3001  
**Root Directory:** `apps/flight-tracker`

#### Deployment Steps

```bash
cd apps/flight-tracker

# Add service to Railway project
railway add --name flight-tracker

# Set root directory in Railway dashboard
# Set to: apps/flight-tracker

# Deploy
railway up
```

#### Railway Configuration

```yaml
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "npm start"
healthcheckTimeout = 100
```

#### Environment Variables

```bash
# Optional (for real flight tracking)
NODE_ENV=production
SERVICE_PORT=3001
FLIGHT_API_KEY=<your-key>
FLIGHTAWARE_API_KEY=<your-key>
AVIATIONSTACK_API_KEY=<your-key>
```

---

### 6. FlightSchool (Python/Flask)

**Status:** 🆕 Not deployed  
**Port:** 5000  
**Root Directory:** `apps/flightschool`

#### Deployment Steps

```bash
cd apps/flightschool

# Add service to Railway project
railway add --name flightschool

# Set root directory in Railway dashboard
# Set to: apps/flightschool

# Deploy
railway up
```

#### Railway Configuration

```yaml
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/"
healthcheckTimeout = 100
```

#### Environment Variables

```bash
# Required
SECRET_KEY=<random-secret>
DATABASE_URL=sqlite:///./instance/flightschool.db

# Google Calendar Integration (optional)
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/callback

# Email Configuration (optional)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=<your-email>
MAIL_PASSWORD=<your-password>
```

---

### 7. Weather Briefing (TypeScript)

**Status:** 🆕 Not deployed  
**Port:** 3003  
**Root Directory:** `apps/weather-briefing`

#### Deployment Steps

```bash
cd apps/weather-briefing

# Add service to Railway project
railway add --name weather-briefing

# Set root directory in Railway dashboard
# Set to: apps/weather-briefing

# Deploy
railway up
```

#### Railway Configuration

```yaml
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "npm start"
healthcheckTimeout = 100
```

#### Environment Variables

```bash
# Optional
NODE_ENV=production
SERVICE_PORT=3003
OPENWEATHERMAP_API_KEY=<your-key>
OPENAI_API_KEY=<your-key>  # For AI-powered analysis
```

---

## 🔐 Environment Variable Management

### Using Railway CLI

```bash
# Set environment variable for a service
railway variables set KEY=value --service accident-tracker

# Get all variables for a service
railway variables --service accident-tracker

# Link environment variables from keystore
# (This would require custom migration script)
```

### Using Railway Dashboard

1. Go to Railway dashboard
2. Select the service
3. Go to "Variables" tab
4. Add environment variables manually

### Migration Script (Optional)

Create a script to migrate keystore secrets to Railway:

```bash
#!/bin/bash
# scripts/migrate-to-railway.sh

# For each service, read from keystore and set in Railway
for service in accident-tracker flight-tracker flightschool weather-briefing; do
  echo "Migrating $service secrets..."
  
  # Example: Get API key from keystore
  API_KEY=$(npm run keystore get $service API_KEY)
  
  # Set in Railway
  railway variables set API_KEY="$API_KEY" --service $service
done
```

---

## 🚦 Deployment Workflow

### For New Services

1. **Create Dockerfile and docker-compose.yml** (✅ Done for all 4 new apps)

2. **Test locally with Docker**
   ```bash
   cd apps/<app-name>
   make docker-build
   make docker-up
   # Test the app
   make docker-down
   ```

3. **Add service to Railway**
   ```bash
   railway add --name <app-name>
   ```

4. **Configure root directory** in Railway dashboard
   - Set to `apps/<app-name>`

5. **Set environment variables** in Railway dashboard

6. **Deploy**
   ```bash
   railway up
   ```

7. **Monitor logs**
   ```bash
   railway logs --tail 100
   ```

8. **Check deployment status**
   ```bash
   railway status
   ```

### For Existing Services

1. **Update root directory** in Railway dashboard
   - Change from old standalone repo path to `apps/<app-name>`

2. **Verify environment variables** are still set correctly

3. **Redeploy**
   ```bash
   cd apps/<app-name>
   railway redeploy
   ```

4. **Monitor for issues**
   ```bash
   railway logs --tail 100
   ```

---

## 🐛 Troubleshooting

### Build Failures

```bash
# View build logs
railway logs --type build

# Common issues:
# - Missing Dockerfile
# - Incorrect root directory
# - Missing dependencies
# - Build timeout
```

### Runtime Failures

```bash
# View runtime logs
railway logs --type deploy --tail 100

# Common issues:
# - Missing environment variables
# - Port binding issues
# - Database connection errors
# - Permission issues
```

### Deployment Not Updating

```bash
# Force redeploy
railway redeploy --force

# Or trigger new deployment
railway up
```

### Service Not Accessible

1. Check service URL in Railway dashboard
2. Verify port configuration
3. Check health check status
4. Review logs for errors

---

## 📊 Monitoring

### Check Service Status

```bash
# All services
railway status

# Specific service
railway status --service accident-tracker
```

### View Logs

```bash
# Tail logs
railway logs --tail 100

# Filter by service
railway logs --service accident-tracker --tail 50

# Follow logs in real-time
railway logs --follow
```

### Check Deployment History

```bash
railway deployment list
```

---

## 🔄 CI/CD Integration

Railway can automatically deploy on git push if configured:

1. **In Railway dashboard**, go to each service
2. Enable "Auto-deploy on commit"
3. Set branch to `main`
4. Set root directory to `apps/<app-name>`

Now every push to `main` will trigger deployment for all changed services.

---

## ✅ Success Criteria

- [ ] Railway CLI installed and authenticated
- [ ] Project linked to monorepo
- [ ] All 7 services added to Railway project
- [ ] Root directories configured for each service
- [ ] Environment variables set for each service
- [ ] All 7 services deployed successfully
- [ ] All 7 services accessible via Railway URLs
- [ ] All warnings investigated and resolved
- [ ] Health checks passing for all services
- [ ] Logs show no critical errors
- [ ] Documentation complete

---

## 📝 Notes

**Railway Plan:** Verify current plan supports 7 services  
**Cost Optimization:** Consider using Railway's "Sleep on Idle" feature  
**Database:** All apps use SQLite with volume persistence  
**Secrets:** Use Railway's environment variables, not .env files

**Next Steps:**
1. Complete Docker testing locally (Story 2)
2. Deploy 4 new services to Railway
3. Investigate and fix warnings on existing 2 services
4. Configure auto-deploy on push
5. Set up monitoring and alerting
