# ForeFlight Dashboard

> **Part of the [Aviation Monorepo](../../README.md)** - A collection of aviation-related applications and SDKs

[![CI/CD Pipeline](https://github.com/jordanhubbard/Aviation/actions/workflows/ci.yml/badge.svg)](https://github.com/jordanhubbard/Aviation/actions/workflows/ci.yml)
[![Security Analysis](https://github.com/jordanhubbard/Aviation/actions/workflows/codeql.yml/badge.svg)](https://github.com/jordanhubbard/Aviation/actions/workflows/codeql.yml)
[![codecov](https://codecov.io/gh/jordanhubbard/Aviation/branch/main/graph/badge.svg)](https://codecov.io/gh/jordanhubbard/Aviation)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)

A modern, stateless web application for analyzing ForeFlight logbook data. This application helps pilots import, validate, and visualize their flight data from ForeFlight CSV exports with advanced validation rules and beautiful visual distinctions. **Completely free and open-source - no accounts, no tracking, no commercial restrictions.**

🐳 **Container-First Architecture**: This application is designed exclusively for containerized deployment. All operations run inside Docker containers for consistency, security, and easy deployment to any container platform.

🔷 **Beads Organization**: This application uses the beads pattern for work organization, enabling parallel development and testing. See [beads.yaml](beads.yaml) for the complete bead structure.

## Features

- **📊 Import & Analyze**: Upload ForeFlight CSV exports for comprehensive analysis
- **✅ Smart Validation**: Advanced validation rules for cross-country flights, ground training, and time accountability
- **🎨 Visual Distinctions**: Pastel backgrounds for ground training (blue) and night flights (purple) with intuitive icons
- **✈️ ICAO Aircraft Codes**: Full support for ICAO aircraft type designators with validation and suggestions
- **📈 Statistics Dashboard**: Real-time flight statistics, totals, and currency tracking
- **🔍 Search & Filter**: Powerful filtering by aircraft, date range, flight type, and more
- **🌙 Night Flight Tracking**: Special highlighting and tracking for night flight experience
- **👨‍🎓 Ground Training Support**: Proper handling and validation of ground training entries
- **🚫 Stateless Architecture**: No user accounts, no data persistence - upload and analyze on-demand

## Quick Start

### Prerequisites
- Docker
- make (optional, for simplified commands)

### Super Simple Setup

Just three commands to get everything running:

```bash
# Start the complete application (builds everything, installs dependencies, starts all services)
make start

# Stop the application
make stop

# Clean up everything (stops, removes containers, deletes images)
make clean
```

### What `make start` does:
1. **Builds** the Docker image with all dependencies (Python, Node.js, React, etc.)
2. **Starts** the stateless application (no database initialization needed)
3. **Serves** the complete application:
   - 🌐 **Main Application**: http://localhost:5051 (FastAPI + React)
   - 📚 **API Documentation**: http://localhost:5051/docs (Interactive API docs)
   - ⚛️ **React Dev Server**: http://localhost:3001 (Development mode only)

<<<<<<< HEAD
### No User Accounts Required
This is a **stateless application** - simply:
1. Start the application with `make start`
2. Open http://localhost:5051 in your browser
3. Upload your ForeFlight CSV file and analyze immediately
4. No registration, login, or data persistence required

### GitHub Codespaces
1. Click the green "Code" button above
2. Select "Open with Codespaces"
3. Click "New codespace"
4. Run: `make start`
5. Access the forwarded port URL (typically port 5051)

### Manual Docker Commands

If you prefer not to use Make, you can run the Docker commands directly:

```bash
# Build the image
docker-compose -f docker-compose.yml build

# Start the application (stateless - no initialization needed)
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose -f docker-compose.yml logs -f

# Stop the application
docker-compose -f docker-compose.yml down

# Clean up
docker-compose -f docker-compose.yml down -v --rmi all
```

## Project Structure

```
foreflight-dashboard/
├── src/                    # Python backend source code
│   ├── main.py            # FastAPI application (replaces Flask)
│   ├── core/              # Core models, validation, and ICAO support
│   │   ├── models.py      # Pydantic data models with validation
│   │   ├── icao_validator.py  # ICAO aircraft code validation
│   │   └── validation.py  # CSV validation logic
│   ├── services/          # Business logic
│   │   ├── importer.py    # ForeFlight CSV import service
│   │   └── foreflight_client.py  # Data processing client
│   └── static/            # Built React frontend assets
├── frontend/              # React frontend source
│   ├── src/               # TypeScript React components
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   └── services/      # API service layer
│   ├── package.json       # Node.js dependencies
│   └── vite.config.ts     # Vite build configuration
├── tests/                 # Comprehensive test suite
│   ├── test_core/         # Core functionality tests
│   ├── test_fastapi/      # API integration tests
│   └── test_services/     # Service layer tests
├── .github/workflows/     # CI/CD pipeline configuration
├── Dockerfile.local       # Multi-stage Docker build
├── docker-compose.yml     # Container orchestration
├── Makefile              # Development workflow commands
└── requirements.txt       # Python dependencies
```

## Key Features

- **🎨 Modern React Frontend** with Material-UI design system and TypeScript
- **🚫 Stateless Architecture** - no user accounts, databases, or data persistence
- **📁 Session-Based Processing** - upload, analyze, and download results instantly
- **✅ Advanced Validation** - smart rules for cross-country, ground training, and time accountability
- **✈️ ICAO Aircraft Support** - comprehensive aircraft type code validation with suggestions
- **🌙 Visual Flight Distinctions** - color-coded entries for ground training and night flights
- **📊 Real-Time Statistics** - instant flight totals, currency tracking, and analysis
- **🔍 Powerful Filtering** - search by aircraft, date, flight type, and validation status
- **📱 Responsive Design** - works perfectly on desktop, tablet, and mobile devices
- **🐳 Container-Ready** - deploy anywhere with Docker, no external dependencies

## Technology Stack

- **Backend**: Python 3.11, FastAPI, Pydantic, Pandas (CSV processing)
- **Frontend**: React 18, TypeScript, Material-UI (MUI), Vite
- **Architecture**: Stateless, session-based processing (no database required)
- **Validation**: Advanced Pydantic models with custom aviation-specific rules
- **Development**: Docker, Docker Compose, hot reloading, multi-stage builds
- **Testing**: Pytest (115 tests), React Testing Library, 53% code coverage
- **CI/CD**: GitHub Actions, CodeQL Security Analysis, automated testing
- **Code Quality**: Black, Flake8, ESLint, Prettier, TypeScript strict mode
- **Security**: Bandit, Safety, SARIF reporting, container security scanning
- **Deployment**: Container-first, supports all major cloud platforms

## CI/CD Pipeline

This project includes a comprehensive CI/CD pipeline with:

### Continuous Integration
- **Multi-Python Testing**: Tests run on Python 3.9, 3.10, and 3.11
- **Code Quality Checks**: Black formatting, Flake8 linting, MyPy type checking
- **Security Scanning**: Bandit (Python), Safety (dependencies), Trivy (Docker)
- **Frontend Testing**: TypeScript compilation, ESLint, Vitest unit tests
- **Integration Tests**: Full application testing with Docker
- **Coverage Reporting**: Automated coverage reports with Codecov integration

### Security & Quality
- **CodeQL Analysis**: GitHub's semantic code analysis for security vulnerabilities
- **Dependency Updates**: Automated dependency updates with Renovate
- **Container Security**: Docker image vulnerability scanning
- **SARIF Integration**: Security findings integrated into GitHub Security tab

### Automated Workflows
- **Pull Request Checks**: All PRs automatically tested and validated
- **Release Management**: Automated releases with multi-platform Docker images
- **Performance Testing**: Basic load testing on main branch changes
- **Dependency Monitoring**: Weekly security scans and update notifications

### Running Tests Locally
```bash
# Run all tests with coverage
make test

# Run specific test categories
pytest tests/test_api/ -v          # API tests only
pytest tests/test_core/ -v         # Core functionality tests
pytest -m "not slow" tests/ -v     # Skip slow integration tests

# Frontend tests
cd frontend
npm test                           # Interactive test runner
npm run test:ci                    # CI mode with coverage
```

## 🚀 Production Deployment

This application is designed for **container-first deployment** and can be deployed on any platform that supports Docker containers. The application is fully self-contained and includes everything needed to run in production.

### 📋 Deployment Requirements

- **Container Runtime**: Docker or compatible (Podman, containerd)
- **Memory**: Minimum 512MB RAM (1GB+ recommended for large CSV files)
- **Storage**: Minimal storage needed (logs only, no persistent data)
- **Network**: Single port exposure (defaults to 5051 for main application)
- **No Database**: Stateless architecture requires no external database

### 🌍 Environment Variables

```bash
# Application Configuration
ENVIRONMENT=production         # Set to 'production' for production deployment
FASTAPI_PORT=5051             # FastAPI application port
REACT_DEV_PORT=3001           # React dev server port (development only)

# File Storage (temporary session files only)
UPLOAD_PATH=/app/uploads      # Temporary file upload directory
LOGS_PATH=/app/logs          # Application logs directory

# Security (Production)
ALLOWED_HOSTS=yourdomain.com,*.yourdomain.com  # Restrict host access
CORS_ORIGINS=https://yourdomain.com            # CORS allowed origins

# Note: No database configuration needed - this is a stateless application
# All data processing happens in-memory during the session
```

### 🐳 Container Platforms

## 🚀 Railway.com (Recommended - Easiest)

**Free tier available, automatic HTTPS, custom domains**

1. **Fork this repository** to your GitHub account
2. **Connect to Railway**: Visit [railway.app](https://railway.app) and sign in with GitHub
3. **Deploy**: Click "New Project" → "Deploy from GitHub repo" → Select your fork
4. **Configure**:
   ```bash
   # Railway automatically detects the Dockerfile
   # Set these environment variables in Railway dashboard:
   ENVIRONMENT=production
   SECRET_KEY=your-random-secret-key-here
   ```
5. **Access**: Railway provides a public URL automatically

**Cost**: Free tier (500 hours/month), $5/month for unlimited

---

## 🌊 DigitalOcean App Platform

**Managed container hosting with built-in CI/CD**

1. **Create App**: Visit [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. **Connect Repository**: Link your GitHub repository
3. **Configure Build**:
   ```yaml
   # .do/app.yaml (create this file in your repo root)
   name: foreflight-dashboard
   services:
   - name: web
     source_dir: /
     github:
       repo: jordanhubbard/foreflight-dashboard
       branch: main
     dockerfile_path: Dockerfile
     http_port: 3001
     instance_count: 1
     instance_size_slug: basic-xxs
     environment_slug: node-js
     envs:
     - key: ENVIRONMENT
       value: production
     - key: SECRET_KEY
       value: your-secret-key
       type: SECRET
   ```
4. **Deploy**: DigitalOcean automatically builds and deploys

**Cost**: $5/month for basic plan

---

## 📦 Heroku Container Registry

**Traditional PaaS with container support**

1. **Install Heroku CLI** and login: `heroku login`
2. **Create App**:
   ```bash
   heroku create your-app-name
   heroku container:login
   ```
3. **Configure Environment**:
   ```bash
   heroku config:set ENVIRONMENT=production
   heroku config:set SECRET_KEY=$(openssl rand -base64 32)
   heroku config:set FASTAPI_PORT=$PORT
   ```
4. **Deploy**:
   ```bash
   heroku container:push web
   heroku container:release web
   ```

**Cost**: $7/month for basic dyno

---

## ☁️ AWS ECS/Fargate

**Scalable container service with AWS integration**

1. **Build and Push Image**:
   ```bash
   # Create ECR repository
   aws ecr create-repository --repository-name foreflight-dashboard
   
   # Get login token
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
   
   # Build and push
   docker build -t foreflight-dashboard .
   docker tag foreflight-dashboard:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/foreflight-dashboard:latest
   docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/foreflight-dashboard:latest
   ```

2. **Create ECS Task Definition**:
   ```json
   {
     "family": "foreflight-dashboard",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "256",
     "memory": "512",
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
         ]
       }
     ]
   }
   ```

3. **Create ECS Service** with Application Load Balancer

**Cost**: ~$15-30/month depending on usage

---

## 🏃 Google Cloud Run

**Serverless container platform, pay-per-use**

1. **Enable Cloud Run API** in Google Cloud Console
2. **Build and Deploy**:
   ```bash
   # Install gcloud CLI and authenticate
   gcloud auth login
   gcloud config set project your-project-id
   
   # Deploy directly from source
   gcloud run deploy foreflight-dashboard \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --port 3001 \
     --set-env-vars ENVIRONMENT=production,SECRET_KEY=your-secret-key
   ```

**Cost**: Pay-per-request, free tier available

---

## 🔷 Azure Container Instances

**Simple container hosting**

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
     --ports 3001 \
     --environment-variables ENVIRONMENT=production SECRET_KEY=your-secret-key \
     --cpu 1 \
     --memory 1
   ```

**Cost**: ~$10-20/month for basic configuration

---

## 🏠 Self-Hosted (VPS/Dedicated Server)

**Full control, any VPS provider (Linode, Vultr, etc.)**

1. **Server Setup** (Ubuntu/Debian):
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   sudo usermod -aG docker $USER
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Deploy Application**:
   ```bash
   # Clone repository
   git clone https://github.com/jordanhubbard/foreflight-dashboard.git
   cd foreflight-dashboard
   
   # Create production environment file
   cat > .env.production << EOF
   ENVIRONMENT=production
   SECRET_KEY=$(openssl rand -base64 32)
   FASTAPI_PORT=5051
   REACT_DEV_PORT=3001
   EOF
   
   # Deploy with Docker Compose
   docker-compose -f docker-compose.yml --env-file .env.production up -d
   ```

3. **Setup Reverse Proxy** (Nginx):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. **SSL Certificate** (Let's Encrypt):
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

**Cost**: $5-20/month depending on VPS provider

---

### 🔒 Production Security Checklist

- [ ] Set `ENVIRONMENT=production`
- [ ] Generate strong `SECRET_KEY` (32+ random characters)
- [ ] Configure `ALLOWED_HOSTS` for your domain
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure `CORS_ORIGINS` for your domain
- [ ] Use persistent volumes for data storage
- [ ] Set up automated backups
- [ ] Monitor application logs
- [ ] Configure health checks
- [ ] Set up monitoring/alerting

### 📊 Monitoring & Health Checks

All deployments include built-in health monitoring:

- **Health Check Endpoint**: `GET /health`
- **API Documentation**: `GET /api/docs`
- **Application Logs**: Available in container logs
- **Metrics**: Basic performance metrics available

### 🔄 Updates & Maintenance

**Automated Updates** (recommended):
```bash
# Set up GitHub Actions for automatic deployment
# See .github/workflows/deploy.yml for examples
```

**Manual Updates**:
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

### 💾 Data Persistence

**Note**: This is a **stateless application** - no data persistence is required or recommended:

- **No Database**: All processing happens in-memory during the session
- **No User Data**: No accounts, profiles, or stored user information
- **Temporary Files**: Uploaded CSV files are processed and discarded
- **Session-Based**: Each upload/analysis session is independent
- **Privacy-First**: No data is retained between sessions

For production deployment, only configure log persistence if needed:

```yaml
# docker-compose.override.yml for production (optional)
version: '3.8'
services:
  foreflight-dashboard:
    volumes:
      - ./logs:/app/logs          # Optional: Log persistence only
```

### 🆘 Troubleshooting

**Common Issues**:

1. **Port Conflicts**: Ensure ports 3001 and 5051 are available
2. **Memory Issues**: Increase container memory to 1GB+
3. **Database Permissions**: Ensure write permissions for `/app/data`
4. **File Upload Issues**: Ensure write permissions for `/app/uploads`

**Debug Mode**:
```bash
# Enable debug logging
docker-compose exec foreflight-dashboard tail -f /app/logs/foreflight.log
```

**Getting Help**:
- Check the [GitHub Issues](https://github.com/jordanhubbard/foreflight-dashboard/issues)
- Review container logs: `docker-compose logs -f`
- Verify health check: `curl http://localhost:3001/health`

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request 
