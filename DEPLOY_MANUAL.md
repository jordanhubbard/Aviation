# Manual Railway Deployment - Step by Step

Since the project is empty, we need to create services first, then deploy.

---

## Method 1: Create Each Service via Dashboard (Easiest)

1. Go to your Railway dashboard:
   **https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd**

2. Click **"+ New"** → **"Empty Service"** for each app:
   - Create service: `aviation-missions-app`
   - Create service: `aviation-accident-tracker`
   - Create service: `flight-tracker`
   - Create service: `flightplanner`
   - Create service: `flightschool`
   - Create service: `foreflight-dashboard`
   - Create service: `weather-briefing`

3. For each service you created:
   - Click on the service
   - Go to **"Settings"**
   - Under **"Source"**, click **"Connect Repo"**
   - Select your GitHub repo: `jordanhubbard/Aviation`
   - Set **Root Directory** to the app path (e.g., `apps/aviation-missions-app`)
   - Click **"Deploy"**

---

## Method 2: Use Railway CLI to Create and Deploy

Run these commands **one at a time** in your terminal:

```bash
cd /Users/jkh/Src/Aviation

# 1. Aviation Missions App
cd apps/aviation-missions-app
railway service
# When prompted, select "Create new service"
# Name it: aviation-missions-app
railway up --detach
cd ../..

# 2. Aviation Accident Tracker
cd apps/aviation-accident-tracker
railway service
# Create new service: aviation-accident-tracker
railway up --detach
cd ../..

# 3. Flight Tracker
cd apps/flight-tracker
railway service
# Create new service: flight-tracker
railway up --detach
cd ../..

# 4. FlightPlanner
cd apps/flightplanner
railway service
# Create new service: flightplanner
railway up --detach
cd ../..

# 5. FlightSchool
cd apps/flightschool
railway service
# Create new service: flightschool
railway up --detach
cd ../..

# 6. ForeFlight Dashboard
cd apps/foreflight-dashboard
railway service
# Create new service: foreflight-dashboard
railway up --detach
cd ../..

# 7. Weather Briefing
cd apps/weather-briefing
railway service
# Create new service: weather-briefing
railway up --detach
cd ../..
```

---

## Method 3: Simple Loop (After Services Exist)

**First**, create all services using Method 1 or 2 above.

**Then**, deploy them all:

```bash
cd /Users/jkh/Src/Aviation

for app in aviation-missions-app aviation-accident-tracker flight-tracker flightplanner flightschool foreflight-dashboard weather-briefing; do
    echo "Deploying $app..."
    cd "apps/$app"
    railway up --service "$app" --detach
    cd ../..
done
```

---

## Why Did It Fail?

The error you saw:
```
> Select a service practical-transformation
Deploy failed
```

This happened because:
1. **No services exist** in your project (you deleted them all)
2. `railway up` needs a service to deploy to
3. The service selector only showed the project name, not actual services
4. You need to **create services first**, then deploy to them

---

## Recommended Approach

**I recommend Method 1 (Dashboard)** because it's:
- Visual and easy to verify
- Shows you exactly what's being created
- Allows you to configure each service
- Less prone to CLI issues

**After creating services via dashboard:**
- Railway will automatically detect the Dockerfile in each app
- It will use the `railway.toml` configuration
- Deployments will start automatically
- You can then use CLI to manage deployments

---

## Quick Check

See what services exist:

```bash
railway service list
```

If this shows nothing, your project is empty and you need to create services first.

---

## After Services Are Created

Set environment variables:

```bash
railway variables set NODE_ENV=production --service aviation-missions-app
railway variables set NODE_ENV=production --service aviation-accident-tracker
# ... etc
```

---

**I recommend using the Railway Dashboard (Method 1) to create all 7 services, then they'll auto-deploy from your repo.** 🚀
