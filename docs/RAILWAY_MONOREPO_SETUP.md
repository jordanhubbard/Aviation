# Railway Monorepo Setup Guide

**Issue:** Railway's GitHub integration names services after the repo ("Aviation"), not individual apps.

**Project:** https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd

---

## The Problem

When connecting a monorepo to Railway via GitHub integration:

1. **Service Name** → Always "Aviation" (repo name) ❌
2. **Config Path** → Can set to `/apps/<app-name>/railway.toml` ✅
3. **Root Directory** → Can set to `apps/<app-name>` ✅

But you need **7 unique service names** for 7 apps.

---

## ✅ Solution: Manual Service Creation + GitHub Connection

### Step 1: Create Empty Services with Custom Names

For each app, create a service in Railway Dashboard:

1. Go to: https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd
2. Click **"+ New"** → **"Empty Service"**
3. Name it with the app name (not repo name):
   - `aviation-missions-app`
   - `aviation-accident-tracker`
   - `flight-tracker`
   - `flight-planner`
   - `flightschool`
   - `foreflight-dashboard`
   - `weather-briefing`

### Step 2: Connect Each Service to GitHub

For **each service**:

1. Click the service (e.g., `aviation-missions-app`)
2. Go to **"Settings"** tab
3. Under **"Source"** section:
   - Click **"Connect Repo"** or **"Configure"**
   - Select: `jordanhubbard/Aviation`
   - Set **"Root Directory"**: `apps/aviation-missions-app`
   - Set **"Branch"**: `main`
4. Click **"Deploy"**

### Step 3: Verify Configuration

Each service should show:
- **Service Name**: Custom name (e.g., `aviation-missions-app`) ✅
- **Source**: `jordanhubbard/Aviation` ✅
- **Root Directory**: `apps/<app-name>` ✅
- **Config File**: Auto-detected `railway.toml` in root directory ✅

---

## Configuration Summary

| Service Name | Root Directory | railway.toml Path |
|--------------|----------------|-------------------|
| aviation-missions-app | `apps/aviation-missions-app` | `apps/aviation-missions-app/railway.toml` |
| aviation-accident-tracker | `apps/aviation-accident-tracker` | `apps/aviation-accident-tracker/railway.toml` |
| flight-tracker | `apps/flight-tracker` | `apps/flight-tracker/railway.toml` |
| flight-planner | `apps/flight-planner` | `apps/flight-planner/railway.toml` |
| flightschool | `apps/flightschool` | `apps/flightschool/railway.toml` |
| foreflight-dashboard | `apps/foreflight-dashboard` | `apps/foreflight-dashboard/railway.toml` |
| weather-briefing | `apps/weather-briefing` | `apps/weather-briefing/railway.toml` |

---

## Why This Works

**Railway's GitHub Integration:**
- ✅ Supports **root directory** per service
- ✅ Supports **railway.toml** in root directory
- ✅ Supports **Dockerfile** in root directory
- ❌ Does NOT auto-name services based on subdirectory

**By creating services manually first:**
- You control the service name ✅
- Then connect GitHub repo with root directory ✅
- Railway uses Dockerfile from that directory ✅

---

## Alternative: Use Railway API (Advanced)

If you prefer automation, use Railway's API to create services:

```bash
# Create service with custom name
curl -X POST https://backboard.railway.app/graphql \
  -H "Authorization: Bearer $RAILWAY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { serviceCreate(input: { name: \"aviation-missions-app\", projectId: \"13aee1ec-6de6-4ae3-9d65-cb5d29d058bd\" }) { id } }"
  }'
```

But the dashboard method is simpler and more reliable.

---

## After Setup: Environment Variables

Once all services are deployed, set environment variables:

```bash
# Essential variables
railway variables set NODE_ENV=production --service aviation-missions-app
railway variables set NODE_ENV=production --service aviation-accident-tracker
railway variables set NODE_ENV=production --service flight-tracker
railway variables set NODE_ENV=production --service weather-briefing
railway variables set ENVIRONMENT=production --service flight-planner
railway variables set ENVIRONMENT=production --service foreflight-dashboard
railway variables set FLASK_ENV=production --service flightschool
```

See `RAILWAY_DEPLOYMENT.md` for app-specific configuration.

---

## Renaming Existing Services

If you already have services named "Aviation":

### Option 1: Rename via Dashboard
1. Click service → Settings → Service Name
2. Change from "Aviation" to app name (e.g., `aviation-missions-app`)
3. Save

### Option 2: Delete and Recreate
1. Delete the incorrectly named service
2. Create new service with correct name (Step 1 above)
3. Connect to GitHub with root directory (Step 2 above)

---

## ✅ Success Checklist

- [ ] 7 services created with unique names
- [ ] Each service connected to `jordanhubbard/Aviation` repo
- [ ] Root directory set for each service (`apps/<app-name>`)
- [ ] Railway detects Dockerfile in each app directory
- [ ] Deployments succeed using Dockerfile (not Railpack)
- [ ] Environment variables set
- [ ] All services accessible via Railway URLs

---

## 🎯 Bottom Line

**Railway DOES support monorepos**, but:
- You must **manually name services** (can't auto-derive from subdirectory)
- Then **connect each to GitHub** with the appropriate root directory
- This is a one-time setup, then deployments work automatically

**The key insight:** Create empty services with custom names FIRST, then connect them to your repo.

---

## 📝 Notes

- Railway's CLI `railway up` tries to auto-create services but uses repo name
- Dashboard gives you full control over service naming
- Once set up, auto-deploy from GitHub works great
- Each service can have different environment variables
- Each service can scale independently

**This setup is perfect for your monorepo once the initial configuration is done!** 🚀
