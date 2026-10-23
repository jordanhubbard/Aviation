# 🚀 ForeFlight Dashboard - Deployment Guide

This guide provides step-by-step instructions for deploying the ForeFlight Dashboard to various container platforms.

## 📋 Pre-Deployment Checklist

Before deploying to any platform, ensure you have:

- [ ] Forked this repository to your GitHub account
- [ ] Generated a secure `SECRET_KEY` (use: `openssl rand -base64 32`)
- [ ] Chosen your deployment platform
- [ ] Prepared any custom domain names (optional)

## 🎯 Quick Deploy Options

### 🥇 Railway.com (Recommended for Beginners)
**Best for**: Quick deployment, free tier, automatic HTTPS

1. **Fork Repository**: Fork this repo to your GitHub account
2. **Sign Up**: Visit [railway.app](https://railway.app) and sign in with GitHub
3. **Deploy**: 
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your forked repository
   - Railway automatically detects the Dockerfile
4. **Configure Environment**:
   ```bash
   ENVIRONMENT=production
   SECRET_KEY=your-generated-secret-key
   ```
5. **Access**: Railway provides a public URL (e.g., `your-app-name.railway.app`)

**Cost**: Free tier (500 hours/month), then $5/month

---

### 🌊 DigitalOcean App Platform
**Best for**: Managed hosting with predictable pricing

1. **Prepare Configuration**: The `.do/app.yaml` file is already included
2. **Create App**: Visit [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
3. **Connect Repository**: Link your GitHub repository
4. **Configure**:
   - DigitalOcean automatically reads `.do/app.yaml`
   - Update the `SECRET_KEY` in the environment variables
   - Update domain names if using custom domains
5. **Deploy**: Click "Create Resources"

**Cost**: $5/month for basic plan

---

### 📦 Heroku (Traditional PaaS)
**Best for**: Familiar deployment process

```bash
# Install Heroku CLI and login
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set ENVIRONMENT=production
heroku config:set SECRET_KEY=$(openssl rand -base64 32)
heroku config:set FASTAPI_PORT=$PORT

# Deploy using containers
heroku container:login
heroku container:push web
heroku container:release web

# Open your app
heroku open
```

**Cost**: $7/month for basic dyno

---

## 🏗️ Advanced Deployment Options

### ☁️ AWS ECS/Fargate

<details>
<summary>Click to expand AWS deployment instructions</summary>

**Prerequisites**: AWS CLI installed and configured

1. **Create ECR Repository**:
   ```bash
   aws ecr create-repository --repository-name foreflight-dashboard
   ```

2. **Build and Push Image**:
   ```bash
   # Get login token
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
   
   # Build image
   docker build -t foreflight-dashboard .
   
   # Tag and push
   docker tag foreflight-dashboard:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/foreflight-dashboard:latest
   docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/foreflight-dashboard:latest
   ```

3. **Create ECS Task Definition** (save as `task-definition.json`):
   ```json
   {
     "family": "foreflight-dashboard",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "256",
     "memory": "512",
     "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
     "containerDefinitions": [
       {
         "name": "foreflight-dashboard",
         "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/foreflight-dashboard:latest",
         "portMappings": [
           {
             "containerPort": 3001,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {"name": "ENVIRONMENT", "value": "production"},
           {"name": "SECRET_KEY", "value": "your-secret-key"}
         ],
         "logConfiguration": {
           "logDriver": "awslogs",
           "options": {
             "awslogs-group": "/ecs/foreflight-dashboard",
             "awslogs-region": "us-east-1",
             "awslogs-stream-prefix": "ecs"
           }
         }
       }
     ]
   }
   ```

4. **Register Task Definition**:
   ```bash
   aws ecs register-task-definition --cli-input-json file://task-definition.json
   ```

5. **Create ECS Service** with Application Load Balancer through AWS Console

**Cost**: ~$15-30/month depending on usage

</details>

---

### 🏃 Google Cloud Run

<details>
<summary>Click to expand Google Cloud deployment instructions</summary>

**Prerequisites**: Google Cloud CLI installed and authenticated

1. **Enable APIs**:
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   ```

2. **Deploy from Source**:
   ```bash
   gcloud run deploy foreflight-dashboard \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --port 3001 \
     --memory 1Gi \
     --cpu 1 \
     --set-env-vars ENVIRONMENT=production,SECRET_KEY=your-secret-key
   ```

3. **Configure Custom Domain** (optional):
   ```bash
   gcloud run domain-mappings create --service foreflight-dashboard --domain yourdomain.com
   ```

**Cost**: Pay-per-request, free tier available

</details>

---

### 🔷 Azure Container Instances

<details>
<summary>Click to expand Azure deployment instructions</summary>

**Prerequisites**: Azure CLI installed and authenticated

1. **Create Resource Group**:
   ```bash
   az group create --name foreflight-rg --location eastus
   ```

2. **Deploy Container**:
   ```bash
   az container create \
     --resource-group foreflight-rg \
     --name foreflight-dashboard \
     --image your-registry/foreflight-dashboard:latest \
     --dns-name-label foreflight-unique-name \
     --ports 3001 \
     --environment-variables ENVIRONMENT=production SECRET_KEY=your-secret-key \
     --cpu 1 \
     --memory 1 \
     --restart-policy Always
   ```

3. **Get Public IP**:
   ```bash
   az container show --resource-group foreflight-rg --name foreflight-dashboard --query ipAddress.fqdn
   ```

**Cost**: ~$10-20/month for basic configuration

</details>

---

## 🏠 Self-Hosted Deployment

### VPS Deployment (Ubuntu/Debian)

Perfect for VPS providers like Linode, Vultr, DigitalOcean Droplets, etc.

1. **Server Setup**:
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   sudo usermod -aG docker $USER
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   
   # Logout and login to apply docker group changes
   ```

2. **Deploy Application**:
   ```bash
   # Clone repository
   git clone https://github.com/your-username/foreflight-dashboard.git
   cd foreflight-dashboard
   
   # Create production environment file
   cp env.production.example .env.production
   
   # Edit environment variables
   nano .env.production  # Update SECRET_KEY and other settings
   
   # Deploy with production configuration
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d
   ```

3. **Setup Nginx Reverse Proxy**:
   ```bash
   # Install Nginx
   sudo apt install nginx -y
   
   # Create site configuration
   sudo tee /etc/nginx/sites-available/foreflight-dashboard << 'EOF'
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           
           # WebSocket support (if needed)
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
       
       # Health check endpoint
       location /health {
           proxy_pass http://localhost:3001/health;
           access_log off;
       }
   }
   EOF
   
   # Enable site
   sudo ln -s /etc/nginx/sites-available/foreflight-dashboard /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **Setup SSL Certificate** (Let's Encrypt):
   ```bash
   # Install Certbot
   sudo apt install certbot python3-certbot-nginx -y
   
   # Get certificate
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   
   # Auto-renewal is setup automatically
   ```

5. **Setup Firewall**:
   ```bash
   sudo ufw allow ssh
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```

**Cost**: $5-20/month depending on VPS provider

---

## 🔒 Production Security Checklist

Before going live, ensure you have:

- [ ] **Strong Secret Key**: Generated with `openssl rand -base64 32`
- [ ] **HTTPS Enabled**: SSL certificate configured
- [ ] **Domain Restrictions**: `ALLOWED_HOSTS` and `CORS_ORIGINS` set correctly
- [ ] **Environment Variables**: All sensitive data in environment variables, not code
- [ ] **Persistent Storage**: Database and uploads stored on persistent volumes
- [ ] **Backups**: Regular database and file backups configured
- [ ] **Monitoring**: Health checks and error monitoring enabled
- [ ] **Updates**: Plan for regular security updates

## 🔄 Updating Your Deployment

### Automated Updates (Recommended)

Most platforms support automatic deployments when you push to your main branch:

- **Railway**: Automatically deploys on git push
- **DigitalOcean**: Enable "Auto Deploy" in app settings
- **Heroku**: Automatic deployments from GitHub
- **Cloud platforms**: Use CI/CD pipelines

### Manual Updates

For self-hosted deployments:

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up --build -d
```

## 📊 Monitoring Your Deployment

### Health Checks

All deployments include a health check endpoint:

```bash
curl https://yourdomain.com/health
# Should return: {"status":"healthy","timestamp":"..."}
```

### Application Logs

View application logs:

```bash
# Docker Compose
docker-compose logs -f

# Individual platforms provide log viewing in their dashboards
```

### Performance Monitoring

Monitor key metrics:
- Response times
- Memory usage
- Database performance
- Error rates

## 🆘 Troubleshooting

### Common Issues

1. **Application Won't Start**:
   - Check environment variables are set correctly
   - Verify SECRET_KEY is set and not empty
   - Check container logs for specific errors

2. **Can't Access Application**:
   - Verify port 3001 is exposed and accessible
   - Check firewall rules
   - Confirm health check endpoint responds

3. **Database Issues**:
   - Ensure persistent storage is configured
   - Check file permissions for SQLite database
   - Verify DATABASE_URL format for external databases

4. **File Upload Issues**:
   - Check upload directory permissions
   - Verify persistent storage for uploads
   - Check file size limits

### Getting Help

1. **Check Logs**: Always start with application logs
2. **Health Check**: Verify `/health` endpoint responds
3. **GitHub Issues**: Search existing issues or create a new one
4. **Documentation**: Review this deployment guide and README

## 📈 Scaling Your Deployment

### Horizontal Scaling

For high-traffic deployments:

- **Load Balancers**: Distribute traffic across multiple instances
- **Database**: Move to managed PostgreSQL for better performance
- **File Storage**: Use object storage (S3, Google Cloud Storage) for uploads
- **Caching**: Add Redis for session storage and caching

### Vertical Scaling

Increase resources:
- **Memory**: Increase to 2GB+ for large logbooks
- **CPU**: Add more CPU cores for faster processing
- **Storage**: Ensure adequate disk space for growth

---

**Need help?** Check the [main README](README.md) or [create an issue](https://github.com/your-username/foreflight-dashboard/issues) on GitHub.
