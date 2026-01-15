# 🚀 Deploy All Apps to Railway - Quick Guide

**Run these commands in your terminal (not in Cursor/IDE):**

---

## Step 1: Open Terminal

Open Terminal.app (or iTerm) and navigate to the project:

```bash
cd /Users/jkh/Src/Aviation
```

---

## Step 2: Link to Railway Project

```bash
railway link
```

**When prompted:**
- Select workspace: **Jordan Hubbard's Projects**
- Select project: **practical-transformation** (or your project name)
- Select environment: **production**

---

## Step 3: Deploy All Apps

Copy and paste this entire block into your terminal:

```bash
cd /Users/jkh/Src/Aviation

echo "========================================="
echo "🚀 Deploying: aviation-missions-app"
echo "========================================="
cd apps/aviation-missions-app && railway up && cd ../..
sleep 3

echo ""
echo "========================================="
echo "🚀 Deploying: aviation-accident-tracker"
echo "========================================="
cd apps/aviation-accident-tracker && railway up && cd ../..
sleep 3

echo ""
echo "========================================="
echo "🚀 Deploying: flight-tracker"
echo "========================================="
cd apps/flight-tracker && railway up && cd ../..
sleep 3

echo ""
echo "========================================="
echo "🚀 Deploying: flightplanner"
echo "========================================="
cd apps/flightplanner && railway up && cd ../..
sleep 3

echo ""
echo "========================================="
echo "🚀 Deploying: flightschool"
echo "========================================="
cd apps/flightschool && railway up && cd ../..
sleep 3

echo ""
echo "========================================="
echo "🚀 Deploying: foreflight-dashboard"
echo "========================================="
cd apps/foreflight-dashboard && railway up && cd ../..
sleep 3

echo ""
echo "========================================="
echo "🚀 Deploying: weather-briefing"
echo "========================================="
cd apps/weather-briefing && railway up && cd ../..

echo ""
echo "========================================="
echo "🎉 All applications deployed!"
echo "========================================="
echo ""
echo "Check Railway dashboard:"
echo "https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd"
```

---

## Expected Output

For each app, you'll see:
1. **Building** - Docker image being built
2. **Deploying** - Image being deployed to Railway
3. **Success** - Deployment URL and status

Each deployment takes 2-5 minutes.

---

## Step 4: Verify Deployments

```bash
railway status
```

Or check the Railway dashboard:
https://railway.com/project/13aee1ec-6de6-4ae3-9d65-cb5d29d058bd

---

## Alternative: Deploy One at a Time

If you prefer to deploy apps individually:

```bash
cd /Users/jkh/Src/Aviation

# Deploy each app
cd apps/aviation-missions-app && railway up && cd ../..
cd apps/aviation-accident-tracker && railway up && cd ../..
cd apps/flight-tracker && railway up && cd ../..
cd apps/flightplanner && railway up && cd ../..
cd apps/flightschool && railway up && cd ../..
cd apps/foreflight-dashboard && railway up && cd ../..
cd apps/weather-briefing && railway up && cd ../..
```

---

## After Deployment: Quick Environment Variables

After all apps are deployed, set these essential variables:

```bash
# Node.js apps
railway variables set NODE_ENV=production --service aviation-missions-app
railway variables set NODE_ENV=production --service aviation-accident-tracker
railway variables set NODE_ENV=production --service flight-tracker
railway variables set NODE_ENV=production --service weather-briefing

# Python apps
railway variables set ENVIRONMENT=production --service flightplanner
railway variables set ENVIRONMENT=production --service foreflight-dashboard
railway variables set FLASK_ENV=production --service flightschool
```

For detailed environment variables, see **RAILWAY_DEPLOY_STEPS.md**.

---

## ⏱️ Time Estimate

- **Total time**: ~15-20 minutes
- **Per app**: ~2-3 minutes

---

## ✅ Success Checklist

After deployment:

- [ ] All 7 services show in Railway dashboard
- [ ] All services have "Deployed" status
- [ ] No build errors in logs
- [ ] Each service has a public URL
- [ ] Health checks passing (where applicable)

---

**Ready? Copy the commands above and run them in your terminal!** 🚀
