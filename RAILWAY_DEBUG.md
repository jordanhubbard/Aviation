# Railway Deployment Debugging Guide

Based on the error "There was an error deploying from source", here's how to debug and fix.

---

## 🔍 Check These Settings in Railway Dashboard

For the **aviation-missions** service:

### 1. Go to Settings

Click on the service → **"Settings"** tab

### 2. Verify Source Configuration

Under **"Source"** section, check:

#### ✅ Repository
- Should be: `jordanhubbard/Aviation`
- Branch: `main`

#### ✅ Root Directory
**This is the most common issue!**

- Should be: `apps/aviation-missions-app`
- If blank or wrong, set it to: `apps/aviation-missions-app`
- Click "Save" or "Update"

#### ✅ Build Configuration
- Builder: Should auto-detect "Dockerfile"
- Config file: Should show `railway.toml` detected

### 3. Check Build Settings

Under **"Build"** section:
- Build Command: (leave blank, Dockerfile handles this)
- Install Command: (leave blank, Dockerfile handles this)

---

## 🚨 Most Likely Issue: Root Directory Not Set

Railway is probably trying to build from the monorepo root (`/`) instead of `apps/aviation-missions-app/`.

**Symptoms:**
- "No start command found"
- "Error deploying from source"
- Railpack trying to build instead of Docker

**Fix:**
1. Settings → Source → Root Directory
2. Set to: `apps/aviation-missions-app`
3. Click "Redeploy" or the error will auto-retry

---

## 📊 How to View Logs in Dashboard

Since Railway CLI requires TTY and can't easily fetch logs:

### View Build Logs:
1. Click on the service
2. Go to **"Deployments"** tab
3. Click on the failed deployment
4. View **"Build Logs"**

### What to Look For:
```
❌ Bad: "No start command was found"
   → Root directory not set

❌ Bad: "Using Railpack"
   → Should be using Dockerfile

✅ Good: "Building with Dockerfile"
   → Correct!

✅ Good: "Step 1/10 : FROM..."
   → Docker build steps
```

---

## ✅ Expected Configuration

For **aviation-missions** service:

```
Service Name: aviation-missions
Repository: jordanhubbard/Aviation
Branch: main
Root Directory: apps/aviation-missions-app  ← CRITICAL!
Builder: Dockerfile (auto-detected)
Config File: railway.toml (auto-detected)
```

---

## 🔧 Step-by-Step Fix

### If Root Directory Is Missing:

1. **Click service** → **Settings**

2. **Scroll to "Source" section**

3. **Find "Root Directory" field**

4. **Enter:** `apps/aviation-missions-app`

5. **Click away to save**

6. **Trigger redeploy:**
   - Go to Deployments tab
   - Click "Deploy" button
   - OR just wait, Railway will auto-retry

### If Repository Not Connected:

1. **Settings** → **Source**

2. **Click "Connect Repo"**

3. **Select:** `jordanhubbard/Aviation`

4. **Set Branch:** `main`

5. **Set Root Directory:** `apps/aviation-missions-app`

6. **Click "Connect"**

---

## 🐛 Common Errors and Fixes

### Error: "No start command was found"
**Cause:** Root directory not set, Railway building from monorepo root  
**Fix:** Set root directory to `apps/aviation-missions-app`

### Error: "Using Railpack... workspace detected"
**Cause:** Railway using Node.js buildpack instead of Dockerfile  
**Fix:** Set root directory, verify Dockerfile exists in that path

### Error: "Failed to build"
**Cause:** Docker build error  
**Fix:** Check build logs for specific error, verify Dockerfile syntax

### Error: "Service won't start"
**Cause:** Missing environment variables or port issues  
**Fix:** Check deploy logs, set required environment variables

---

## 📝 Verification Checklist

After fixing configuration, verify:

- [ ] Settings → Source → Root Directory = `apps/aviation-missions-app`
- [ ] Settings → Source → Repository = `jordanhubbard/Aviation`
- [ ] Settings → Source → Branch = `main`
- [ ] Deployment shows "Building with Dockerfile"
- [ ] Build logs show Docker steps (Step 1/10, 2/10, etc.)
- [ ] No "Railpack" or "workspace" messages
- [ ] Deployment succeeds
- [ ] Service shows "Active" status
- [ ] Health check passes (if configured)

---

## 🎯 Quick Test

Once root directory is set correctly, you should see in build logs:

```
✓ Building with Dockerfile
Step 1/10 : FROM clojure:openjdk-11-lein
...
Successfully built 123abc456def
```

NOT:

```
✗ Using Railpack
✗ Detected workspace with 7 packages
✗ No start command was found
```

---

## 🚀 After Fixing

Once the first service deploys successfully:

1. **Repeat for all other services:**
   - aviation-accident-tracker → `apps/aviation-accident-tracker`
   - flight-tracker → `apps/flight-tracker`
   - flightplanner → `apps/flightplanner`
   - flightschool → `apps/flightschool`
   - foreflight-dashboard → `apps/foreflight-dashboard`
   - weather-briefing → `apps/weather-briefing`

2. **Set environment variables** (see RAILWAY_DEPLOYMENT.md)

3. **Verify all services deploy** successfully

---

## 📞 If Still Stuck

If deployment still fails after setting root directory:

1. **Check Dockerfile exists:**
   ```bash
   ls -la apps/aviation-missions-app/Dockerfile
   ```
   Should show the Dockerfile

2. **Test Docker build locally:**
   ```bash
   cd apps/aviation-missions-app
   docker build .
   ```
   Should build without errors

3. **Check railway.toml:**
   ```bash
   cat apps/aviation-missions-app/railway.toml
   ```
   Should show builder = "DOCKERFILE"

4. **Share the build logs** from Railway Dashboard for specific error analysis

---

**Bottom line: 99% of the time, the issue is the Root Directory not being set!** ✅
