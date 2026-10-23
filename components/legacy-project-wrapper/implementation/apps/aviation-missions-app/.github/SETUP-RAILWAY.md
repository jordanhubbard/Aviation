# Railway Deployment Setup - Step by Step

## Prerequisites
✅ Railway account created
✅ GitHub repository linked to Railway
✅ This is already done!

## Required: Set Up GitHub Actions Secret

For automatic deployments on push, you need to add your Railway token to GitHub:

### 1. Get Your Railway Token

**Option A: Via Railway Dashboard**
1. Go to https://railway.app/account/tokens
2. Click "Create New Token"
3. Give it a name (e.g., "GitHub Actions")
4. Copy the token (save it somewhere safe!)

**Option B: Via Railway CLI** (if installed)
```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Get token
railway tokens
```

### 2. Add Token to GitHub Secrets

1. Go to your repository settings:
   ```
   https://github.com/jordanhubbard/aviation-missions-app/settings/secrets/actions
   ```

2. Click **"New repository secret"**

3. Fill in:
   - **Name**: `RAILWAY_TOKEN`
   - **Secret**: Paste your Railway token from step 1
   
4. Click **"Add secret"**

### 3. Verify Setup

After adding the secret:

1. Make any small change (e.g., update README)
2. Commit and push to `main` branch:
   ```bash
   git add .
   git commit -m "test: verify Railway deployment"
   git push origin main
   ```

3. Watch the deployment:
   - Go to: https://github.com/jordanhubbard/aviation-missions-app/actions
   - Click on the latest "Deploy to Railway" workflow
   - Watch it complete successfully ✅

4. Check Railway dashboard to see your deployed app!

## Done! 🎉

Your app will now automatically deploy to Railway whenever you push to `main` branch.

### What happens on each push:

1. ✅ GitHub Actions workflow triggers
2. ✅ Railway CLI deploys your app
3. ✅ Railway builds Docker image
4. ✅ Railway runs health checks
5. ✅ Your app is live!

### Useful Commands

Once Railway CLI is installed locally:

```bash
# View your app
railway open

# View logs
railway logs --follow

# Check status
railway status

# Deploy manually
railway up

# View environment variables
railway variables

# Set environment variable
railway variables set KEY=value
```

### Railway Dashboard

View your deployment at: https://railway.app/dashboard

From there you can:
- 🌐 Get your public URL
- 📊 View metrics (CPU, memory, network)
- 📝 Check deployment logs
- ⚙️ Configure environment variables
- 🔧 Set custom domain
- 💾 Manage volumes/storage

## Troubleshooting

### Workflow fails with "RAILWAY_TOKEN not found"
→ Make sure you added the secret with exact name `RAILWAY_TOKEN`

### Deployment succeeds but app not accessible
→ Check Railway dashboard for your public URL
→ Railway may still be starting up (check logs)

### Need to redeploy
```bash
# Via GitHub Actions
# Go to Actions → Deploy to Railway → Run workflow (manually trigger)

# Via CLI
railway up --force
```

## Next Steps

1. ✅ Set up RAILWAY_TOKEN secret (required)
2. Set production admin credentials in Railway dashboard:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
3. Configure custom domain (optional)
4. Set up monitoring alerts (optional)

---

**Questions?** Check `.github/RAILWAY.md` for detailed documentation!

