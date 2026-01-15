# Fix Railway Service Configuration

**Problem:** Railway is building from the monorepo root instead of each app's directory.

**Error:** "No start command was found" - Railway's Railpack is detecting a Node.js workspace but trying to build from root.

**Solution:** Set the Root Directory for each service.

---

## Method 1: Via Railway Dashboard (Recommended)

For **each of the 7 services** in your Railway dashboard:

1. Go to: https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd

2. Click on the service (e.g., `aviation-missions-app`)

3. Go to **"Settings"** tab

4. Scroll down to **"Source"** section

5. Find **"Root Directory"** field

6. Set it to the app path:
   - `aviation-missions-app` → `apps/aviation-missions-app`
   - `aviation-accident-tracker` → `apps/aviation-accident-tracker`
   - `flight-tracker` → `apps/flight-tracker`
   - `flightplanner` → `apps/flightplanner`
   - `flightschool` → `apps/flightschool`
   - `foreflight-dashboard` → `apps/foreflight-dashboard`
   - `weather-briefing` → `apps/weather-briefing`

7. Click **"Deploy"** or let it auto-deploy

8. Repeat for all 7 services

---

## Method 2: Via Railway CLI

```bash
cd /Users/jkh/Src/Aviation

# Set root directory for each service
railway service --name aviation-missions-app && railway vars set RAILWAY_ROOT_DIRECTORY=apps/aviation-missions-app
railway service --name aviation-accident-tracker && railway vars set RAILWAY_ROOT_DIRECTORY=apps/aviation-accident-tracker
railway service --name flight-tracker && railway vars set RAILWAY_ROOT_DIRECTORY=apps/flight-tracker
railway service --name flightplanner && railway vars set RAILWAY_ROOT_DIRECTORY=apps/flightplanner
railway service --name flightschool && railway vars set RAILWAY_ROOT_DIRECTORY=apps/flightschool
railway service --name foreflight-dashboard && railway vars set RAILWAY_ROOT_DIRECTORY=apps/foreflight-dashboard
railway service --name weather-briefing && railway vars set RAILWAY_ROOT_DIRECTORY=apps/weather-briefing
```

---

## Why This Happens

Railway detected your monorepo structure:
```
✓ Found workspace with 7 packages
```

But it's trying to build from the root (`/Users/jkh/Src/Aviation`) where:
- There's no `"start"` script in root `package.json`
- There's no `"main"` field pointing to an entry file
- There's no `index.js` or `index.ts` in root

**Each app is in a subdirectory** (`apps/<app-name>/`) with its own:
- `Dockerfile` ✅
- `package.json` with `start` script ✅
- `railway.toml` configuration ✅

Railway just needs to be told to look in the right subdirectory.

---

## What Should Happen After Fixing

Once you set the root directory for each service:

1. **Railway will:**
   - Look in `apps/<app-name>/` directory
   - Find the `Dockerfile`
   - Use the `railway.toml` configuration
   - Build the Docker image
   - Deploy the container

2. **You'll see:**
   - Build logs showing Docker build steps
   - "Building with Dockerfile" instead of "Using Railpack"
   - Successful deployment

---

## Quick Check: Root Directory Settings

To verify root directories are set correctly, check each service in dashboard:

**Expected Configuration:**
```
Service: aviation-missions-app
Root Directory: apps/aviation-missions-app
Builder: Dockerfile
✓ Configured correctly

Service: aviation-accident-tracker
Root Directory: apps/aviation-accident-tracker
Builder: Dockerfile
✓ Configured correctly

... (repeat for all 7)
```

---

## After Fixing: Trigger Redeploy

After setting root directories, trigger a new deployment:

### Via Dashboard:
- Click service → **"Deployments"** → **"Deploy"** button

### Via CLI:
```bash
railway redeploy --service aviation-missions-app
railway redeploy --service aviation-accident-tracker
railway redeploy --service flight-tracker
railway redeploy --service flightplanner
railway redeploy --service flightschool
railway redeploy --service foreflight-dashboard
railway redeploy --service weather-briefing
```

---

## Alternative: Create Services with Root Directory

If you haven't created all services yet, you can create them with the root directory set:

```bash
cd /Users/jkh/Src/Aviation

# Create service with source repo
railway add --name aviation-missions-app --repo jordanhubbard/Aviation --root apps/aviation-missions-app
railway add --name aviation-accident-tracker --repo jordanhubbard/Aviation --root apps/aviation-accident-tracker
# ... etc
```

---

## Summary

**Problem:** Railway building from root (monorepo) ❌  
**Solution:** Set Root Directory to `apps/<app-name>` for each service ✅  
**Result:** Railway uses Dockerfile in each app directory ✅

---

**Recommended: Use Railway Dashboard (Method 1) to set root directories visually.** 🚀

It's the most reliable and lets you see exactly what's configured for each service.
