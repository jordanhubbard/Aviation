# 🚂 Railway Deployment Guide

This application is configured for automatic deployment to Railway with zero-configuration setup.

## Quick Start

### Prerequisites
- A [Railway account](https://railway.app)
- GitHub repository connected to Railway

### Setup Steps

1. **Create Railway Project**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Initialize project (in your repo directory)
   railway init
   ```

2. **Connect GitHub Repository**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Create new project → Deploy from GitHub repo
   - Select `jordanhubbard/aviation-missions-app`
   - Railway will auto-detect the Dockerfile and `railway.toml`

3. **Configure GitHub Actions** (for automatic deployments)
   
   a. Get your Railway API token:
   ```bash
   railway tokens
   ```
   
   b. Add to GitHub Secrets:
   - Go to: `https://github.com/jordanhubbard/aviation-missions-app/settings/secrets/actions`
   - Click "New repository secret"
   - Name: `RAILWAY_TOKEN`
   - Value: Your token from step a
   - Click "Add secret"

4. **Deploy!**
   - Push to `main` branch → automatic deployment
   - Or manually trigger: Actions → Deploy to Railway → Run workflow

## Configuration

### Railway Configuration (`railway.toml`)

The application is configured with:
- **Builder**: Dockerfile
- **Health Check**: `/health` endpoint
- **Auto-restart**: On failure (max 10 retries)
- **Port**: Automatically assigned by Railway

### Environment Variables

Railway automatically provides:
- `PORT` - Your app listens on this port
- `RAILWAY_ENVIRONMENT` - `production` or `staging`
- `RAILWAY_PUBLIC_DOMAIN` - Your app's public URL

Optional variables you can set in Railway dashboard:
- `ADMIN_USERNAME` - Admin login (default: `admin`)
- `ADMIN_PASSWORD` - Admin password (default: `aviation123`)
- `DATABASE_URL` - H2 database path (default: `./data/aviation-missions`)

### Setting Environment Variables

Via Railway CLI:
```bash
railway variables set ADMIN_USERNAME=youradmin
railway variables set ADMIN_PASSWORD=supersecret123
```

Via Railway Dashboard:
1. Go to your project
2. Click on your service
3. Go to "Variables" tab
4. Add variables

## Deployment Process

### Automatic (Recommended)
1. Push code to `main` branch
2. GitHub Actions triggers Railway deployment
3. Railway builds Docker image
4. Railway deploys and runs health checks
5. Your app is live!

### Manual Deployment

```bash
# Deploy current directory
railway up

# Deploy specific service
railway up --service aviation-missions-app

# View deployment logs
railway logs

# Open your app in browser
railway open
```

## Monitoring

### View Logs
```bash
# Live logs
railway logs --follow

# Recent logs
railway logs --tail 100
```

### Check Status
```bash
# Service status
railway status

# Health check
curl https://your-app.up.railway.app/health
```

### Railway Dashboard
- View metrics: CPU, memory, network usage
- Check deployment history
- Monitor build logs
- View domain/URL

## Database Persistence

Railway automatically creates persistent volumes for:
- `/app/data/` - H2 database files

Your data persists across deployments!

## Troubleshooting

### Build Failures

Check Railway logs:
```bash
railway logs --build
```

Common issues:
- Docker build timeout → Increase timeout in Railway settings
- Out of memory → Upgrade Railway plan
- Missing dependencies → Check Dockerfile

### Runtime Issues

Check application logs:
```bash
railway logs
```

Test health check:
```bash
curl https://your-app.up.railway.app/health
```

Common issues:
- Port binding → Railway sets `PORT` env var automatically
- Database connection → Check volume mounts in Railway dashboard
- Memory limits → Upgrade Railway plan

### Redeploy

Force a redeploy:
```bash
# Via CLI
railway up --force

# Via API
railway redeploy
```

## Railway Features Used

- ✅ **Dockerfile Support** - Custom build process
- ✅ **Health Checks** - Automatic monitoring
- ✅ **Auto-restart** - Automatic recovery from failures
- ✅ **Persistent Volumes** - Database storage
- ✅ **Automatic HTTPS** - Free SSL certificates
- ✅ **Environment Variables** - Secure configuration
- ✅ **GitHub Integration** - Automatic deployments
- ✅ **Logs & Metrics** - Built-in monitoring

## Cost Optimization

Free tier includes:
- $5 in credits per month
- Shared CPU and memory
- 1GB storage
- Automatic SSL

For production:
- Upgrade to Pro plan
- Get dedicated resources
- Higher resource limits
- Priority support

## Getting Help

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **GitHub Issues**: https://github.com/jordanhubbard/aviation-missions-app/issues

## Next Steps

After deployment:
1. Visit your Railway dashboard for the public URL
2. Test the application: `https://your-app.up.railway.app`
3. Set custom domain (Railway Settings → Domains)
4. Configure production admin credentials
5. Set up monitoring alerts
6. Configure backups for database

---

**Need help?** Open an issue or check the Railway documentation!

