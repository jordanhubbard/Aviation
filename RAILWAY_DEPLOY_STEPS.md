# Railway Deployment - Step-by-Step Guide

**Project:** https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd  
**Date:** January 15, 2026

Since you've deleted all existing apps from Railway, here's how to deploy all 7 apps fresh.

---

## 🚀 Quick Start (Automated)

I've created a deployment script and railway.toml files for all apps.

### Option 1: Run the Deployment Script

```bash
cd /Users/jkh/Src/Aviation
./scripts/deploy-to-railway.sh
```

The script will:
1. Link to your Railway project
2. Deploy all 7 apps one by one
3. Use the railway.toml configuration for each app

**Note:** The script requires interactive input for project selection.

---

## 📝 Manual Deployment (If Script Fails)

If the automated script doesn't work, follow these manual steps for each app.

### Step 1: Link to Project

```bash
cd /Users/jkh/Src/Aviation
railway link
# Select: practical-transformation (or your project name)
# Select: production environment
```

### Step 2: Deploy Each App

For each of the 7 apps, run these commands:

#### 1. Aviation Missions App

```bash
cd /Users/jkh/Src/Aviation/apps/aviation-missions-app
railway up
# Wait for deployment to complete
cd ../..
```

#### 2. Aviation Accident Tracker

```bash
cd /Users/jkh/Src/Aviation/apps/aviation-accident-tracker
railway up
# Wait for deployment to complete
cd ../..
```

#### 3. Flight Tracker

```bash
cd /Users/jkh/Src/Aviation/apps/flight-tracker
railway up
# Wait for deployment to complete
cd ../..
```

#### 4. FlightPlanner

```bash
cd /Users/jkh/Src/Aviation/apps/flightplanner
railway up
# Wait for deployment to complete
cd ../..
```

#### 5. FlightSchool

```bash
cd /Users/jkh/Src/Aviation/apps/flightschool
railway up
# Wait for deployment to complete
cd ../..
```

#### 6. ForeFlight Dashboard

```bash
cd /Users/jkh/Src/Aviation/apps/foreflight-dashboard
railway up
# Wait for deployment to complete
cd ../..
```

#### 7. Weather Briefing

```bash
cd /Users/jkh/Src/Aviation/apps/weather-briefing
railway up
# Wait for deployment to complete
cd ../..
```

---

## 🔧 Post-Deployment Configuration

After all apps are deployed, you need to set environment variables for each service.

### Set Environment Variables

#### For All Apps (Common Variables)

```bash
# Set NODE_ENV for Node.js apps
railway variables set NODE_ENV=production --service aviation-missions-app
railway variables set NODE_ENV=production --service aviation-accident-tracker
railway variables set NODE_ENV=production --service flight-tracker
railway variables set NODE_ENV=production --service weather-briefing

# Set environment for Python apps
railway variables set FLASK_ENV=production --service flightschool
railway variables set ENVIRONMENT=production --service flightplanner
railway variables set ENVIRONMENT=production --service foreflight-dashboard
```

#### Aviation Missions App

```bash
railway variables set API_PORT=3000 --service aviation-missions-app
railway variables set ENVIRONMENT=production --service aviation-missions-app
railway variables set DATABASE_URL=./data/aviation-missions --service aviation-missions-app
```

#### Aviation Accident Tracker

```bash
railway variables set BACKEND_PORT=3002 --service aviation-accident-tracker
railway variables set DATABASE_PATH=/app/data/accidents.db --service aviation-accident-tracker
railway variables set LOG_LEVEL=info --service aviation-accident-tracker
```

#### Flight Tracker

```bash
railway variables set SERVICE_PORT=3001 --service flight-tracker
# Optional: Add flight API keys if available
railway variables set FLIGHT_API_KEY=<your-key> --service flight-tracker
```

#### FlightPlanner

```bash
railway variables set OPENWEATHERMAP_API_KEY=<your-key> --service flightplanner
railway variables set SECRET_KEY=<random-secret> --service flightplanner
railway variables set DATABASE_URL=sqlite:///./data/flightplanner.db --service flightplanner
```

#### FlightSchool

```bash
railway variables set SECRET_KEY=<random-secret> --service flightschool
railway variables set DATABASE_URL=sqlite:///./instance/flightschool.db --service flightschool
# Optional: Google Calendar integration
railway variables set GOOGLE_CLIENT_ID=<your-id> --service flightschool
railway variables set GOOGLE_CLIENT_SECRET=<your-secret> --service flightschool
```

#### ForeFlight Dashboard

```bash
railway variables set SECRET_KEY=<random-secret> --service foreflight-dashboard
railway variables set DATABASE_URL=sqlite:///./data/foreflight.db --service foreflight-dashboard
railway variables set OPENWEATHERMAP_API_KEY=<your-key> --service foreflight-dashboard
```

#### Weather Briefing

```bash
railway variables set SERVICE_PORT=3003 --service weather-briefing
railway variables set OPENWEATHERMAP_API_KEY=<your-key> --service weather-briefing
# Optional: AI analysis
railway variables set OPENAI_API_KEY=<your-key> --service weather-briefing
```

---

## 🔍 Verification

### Check Deployment Status

```bash
railway status
```

### View Service URLs

Go to Railway dashboard and check each service for its public URL.

### Check Logs

```bash
# View logs for a specific service
railway logs --service aviation-missions-app
railway logs --service aviation-accident-tracker
railway logs --service flight-tracker
railway logs --service flightplanner
railway logs --service flightschool
railway logs --service foreflight-dashboard
railway logs --service weather-briefing
```

### Test Each Service

Once deployed, visit each service URL and verify it's working:

1. **Aviation Missions App**: Check /health endpoint
2. **Aviation Accident Tracker**: Check /health endpoint  
3. **Flight Tracker**: Service should be running (check logs)
4. **FlightPlanner**: Check /health endpoint and frontend
5. **FlightSchool**: Check home page loads
6. **ForeFlight Dashboard**: Check /health endpoint and frontend
7. **Weather Briefing**: Service should be running (check logs)

---

## 🐛 Troubleshooting

### Build Failures

If a deployment fails to build:

1. Check Railway build logs
2. Verify Dockerfile exists
3. Verify railway.toml is correct
4. Check for missing dependencies

### Runtime Failures

If a service fails to start:

1. Check Railway deploy logs
2. Verify environment variables are set
3. Check health check configuration
4. Verify port configuration

### Redeploy a Service

```bash
cd /Users/jkh/Src/Aviation/apps/<app-name>
railway redeploy
```

---

## 📊 Expected Result

After following these steps, you should have:

- ✅ 7 services deployed to Railway
- ✅ All services running (may sleep after inactivity)
- ✅ Environment variables configured
- ✅ Public URLs accessible
- ✅ No build or runtime errors

---

## 🎁 railway.toml Files Created

I've created `railway.toml` files for all 7 apps:

- `apps/aviation-missions-app/railway.toml`
- `apps/aviation-accident-tracker/railway.toml`
- `apps/flight-tracker/railway.toml`
- `apps/flightplanner/railway.toml`
- `apps/flightschool/railway.toml`
- `apps/foreflight-dashboard/railway.toml`
- `apps/weather-briefing/railway.toml`

These files configure:
- Docker builder
- Health check paths
- Restart policies
- Deployment settings

---

## ⚡ Quick Commands Reference

```bash
# Link to project
railway link

# Deploy app (from app directory)
railway up

# Set environment variable
railway variables set KEY=value --service <service-name>

# View logs
railway logs --service <service-name>

# Check status
railway status

# Redeploy
railway redeploy --service <service-name>

# View service list
railway service list
```

---

## 📝 Notes

- Each `railway up` command will create a new service in your project
- Services may take 2-5 minutes to build and deploy
- Railway will auto-detect the Dockerfile in each app directory
- The railway.toml file provides additional configuration
- Environment variables must be set manually after initial deployment

---

**Good luck with the deployment! Let me know if you encounter any issues.** 🚀
