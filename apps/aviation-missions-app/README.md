# ✈️ Aviation Mission Management System

[![CI/CD Pipeline](https://github.com/jordanhubbard/aviation-missions-app/actions/workflows/ci.yml/badge.svg)](https://github.com/jordanhubbard/aviation-missions-app/actions/workflows/ci.yml)
[![Deploy to Railway](https://github.com/jordanhubbard/aviation-missions-app/actions/workflows/deploy-railway.yml/badge.svg)](https://github.com/jordanhubbard/aviation-missions-app/actions/workflows/deploy-railway.yml)
[![PR Validation](https://github.com/jordanhubbard/aviation-missions-app/actions/workflows/pr-check.yml/badge.svg)](https://github.com/jordanhubbard/aviation-missions-app/actions/workflows/pr-check.yml)
[![Nightly Checks](https://github.com/jordanhubbard/aviation-missions-app/actions/workflows/nightly.yml/badge.svg)](https://github.com/jordanhubbard/aviation-missions-app/actions/workflows/nightly.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io-blue)](https://ghcr.io/jordanhubbard/aviation-missions-app)
[![Railway](https://img.shields.io/badge/deploy-railway-blueviolet)](https://railway.app)

> A modern, full-stack web application for managing general aviation training missions. Built with Clojure backend and Pure JavaScript frontend, featuring a comprehensive mission catalog, community interactions, and administrative tools.

## 🌐 Live Demo

**Deployed on Railway**: The application is automatically deployed on every push to `main` branch.

👉 **[View Live Application](https://aviation-missions-app-production.up.railway.app)** _(Check Railway dashboard for your actual URL)_

## 🌟 Features

### Core Functionality
- **📚 Mission Catalog**: Browse and search aviation training missions by category, difficulty, and pilot experience level
- **🎯 Mission Details**: Comprehensive mission information including objectives, procedures, routes, and flight challenges
- **💬 Community Features**: Comments, ratings, and completion tracking for each mission
- **📝 Mission Submission**: Community-driven mission suggestions with administrative review workflow
- **👨‍💼 Admin Panel**: Administrative tools for mission management, user oversight, and system configuration

### Technical Features
- **🔍 Advanced Filtering**: Real-time search and filtering by multiple criteria
- **📱 Responsive Design**: Modern dark-themed UI that works seamlessly on all devices
- **🔒 Secure Authentication**: Admin authentication with session management
- **📊 API Documentation**: Full OpenAPI/Swagger documentation with interactive interface
- **💾 Data Persistence**: Robust H2 database with backup/restore capabilities
- **🚀 Containerized Deployment**: Docker-based deployment with multi-stage builds

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jordanhubbard/aviation-missions-app.git
   cd aviation-missions-app
   ```

2. **Build and start the application**:
   ```bash
   make build
   make start
   ```

3. **Access the application**:
   - **Web Interface**: http://localhost:8080
   - **API Documentation**: http://localhost:8080/api/swagger.json
   - **API Endpoint**: http://localhost:8080/api

### Custom Configuration

Override default ports using environment variables:

```bash
# Use custom ports
PORT=9000 make start

# Or set permanently
export PORT=9000
make start
```

## 🏗️ Architecture

### Technology Stack

#### Backend (Clojure)
- **Framework**: Ring + Compojure for HTTP handling
- **Database**: H2 embedded database with file persistence
- **API**: RESTful JSON API with comprehensive endpoints
- **Documentation**: OpenAPI/Swagger specification
- **Testing**: Clojure.test with comprehensive test suite

#### Frontend (ClojureScript + Reagent)
- **Framework**: Reagent (ClojureScript React wrapper)
- **Build Tool**: Shadow-CLJS for compilation and hot reloading
- **State Management**: Reagent atoms with reactive updates
- **HTTP Client**: cljs-http for API communication
- **UI Framework**: Custom dark theme with responsive design

#### Infrastructure
- **Containerization**: Multi-stage Docker builds for optimization
- **Reverse Proxy**: Nginx for serving static assets and API proxying
- **Database**: File-based H2 with volume persistence
- **CI/CD**: GitHub Actions with comprehensive testing and security scanning

## 📖 API Reference

### Mission Management
- `GET /api/missions` - List all missions with optional filtering
- `GET /api/missions/:id` - Retrieve specific mission details
- `POST /api/missions` - Create new mission (admin only)
- `PUT /api/missions/:id` - Update existing mission (admin only)
- `DELETE /api/missions/:id` - Delete mission (admin only)

### Community Interactions
- `GET /api/missions/:id/comments` - Get mission comments
- `POST /api/missions/:id/comments` - Add comment to mission
- `POST /api/missions/:id/complete` - Mark mission as completed
- `POST /api/missions/:id/rate` - Rate mission (1-5 stars)
- `GET /api/missions/:id/rating` - Get user's rating for mission

### Mission Submissions
- `GET /api/submissions` - List pending submissions (admin only)
- `POST /api/missions/submit` - Submit new mission for review
- `PUT /api/submissions/:id/approve` - Approve submission (admin only)
- `PUT /api/submissions/:id/reject` - Reject submission (admin only)

### System Endpoints
- `GET /health` - Application health check
- `GET /api/swagger.json` - OpenAPI specification
- `GET /api/missions/export/yaml` - Export all missions as YAML
- `GET /api/admin/status` - Check admin authentication status
- `POST /api/admin/login` - Admin login

## 🛠️ Development

### Local Development Setup

#### Prerequisites for Local Development
- **Java 21+** (for Clojure backend)
- **Leiningen** (Clojure build tool)
- **Node.js 18+** (for ClojureScript frontend)
- **npm** (Node package manager)

#### Development Options

1. **Production deployment (Recommended)**:
   ```bash
   make start
   # Full Docker deployment - no local setup required
   ```

2. **Local backend development** (requires Java + Leiningen):
   ```bash
   make dev-backend
   # Starts Clojure REPL server on http://localhost:3000
   ```

3. **Local frontend development** (requires Node.js):
   ```bash
   make dev-frontend
   # Starts Shadow-CLJS with hot reloading
   ```

**Note**: There is no `make dev` command as it requires a `docker-compose.dev.yml` file that is not included. For full development, use `make start` for Docker deployment, or run backend and frontend separately with local tools.

### Code Quality

```bash
# Comprehensive linting (clj-kondo + eastwood + compilation)
make lint

# Fast syntax checking
make lint-fast

# Deep static analysis
make lint-eastwood
```

### Testing

```bash
# Run all tests
make test-local

# Backend tests only
cd backend && lein test

# Frontend build verification
cd frontend && npm run build
```

## 🚢 Deployment

### Railway Deployment (Recommended)

The application is configured for automatic deployment to Railway:

#### Initial Setup

1. **Link Railway to GitHub**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Link your project
   railway link
   ```

2. **Set up GitHub Secret**:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add new secret: `RAILWAY_TOKEN`
   - Get your token from: `railway tokens` or Railway dashboard

3. **Automatic Deployments**:
   - Every push to `main` branch automatically deploys to Railway
   - Monitor deployments in the Actions tab
   - View your app at your Railway domain

#### Manual Deployment

```bash
# Deploy from local
railway up

# View logs
railway logs

# Open your app
railway open
```

#### Railway Environment Variables

Railway automatically configures:
- `PORT` - Dynamically assigned by Railway
- `RAILWAY_ENVIRONMENT` - Production/staging environment
- `RAILWAY_PUBLIC_DOMAIN` - Your app's public URL

No additional configuration needed! The app automatically detects Railway's PORT variable.

### Docker Deployment

```bash
# Production deployment
make start

# View logs
make logs

# Stop application
make stop

# Complete cleanup
make clean
```

### Other Cloud Platforms

The application also supports deployment on:

- **Heroku**: Container registry deployment
- **AWS ECS**: Fargate or EC2 deployment
- **Google Cloud Run**: Serverless container deployment
- **Azure Container Instances**: Simple container hosting
- **Kubernetes**: Full orchestration support

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Main application port (Railway sets this automatically) |
| `DATABASE_URL` | `./data/aviation-missions` | H2 database location |
| `ENVIRONMENT` | `production` | Runtime environment |
| `ADMIN_USERNAME` | `admin` | Admin login username |
| `ADMIN_PASSWORD` | `aviation123` | Admin login password (change in production!) |

**Note**: Both frontend and API are served on the same port, with API endpoints under `/api/*` path.

## 🔄 CI/CD Pipeline

This project includes a comprehensive CI/CD pipeline powered by GitHub Actions:

### Automated Workflows

- **🚀 CI/CD Pipeline** (`ci.yml`): Runs on every push and pull request
  - Code quality analysis (linting with clj-kondo)
  - Backend unit tests
  - Docker build and integration tests
  - Multi-platform image builds (amd64, arm64)
  - Security scanning with Trivy
  - Container image publishing to GitHub Container Registry

- **🚂 Railway Deployment** (`deploy-railway.yml`): Automatic deployments
  - Triggers on every push to `main` branch
  - Can be manually triggered via GitHub Actions
  - Deploys to Railway using Railway CLI
  - Provides deployment status and verification

- **🔍 Pull Request Validation** (`pr-check.yml`): Validates PRs
  - Conventional commit format checking
  - Fast compilation and critical tests
  - Build size monitoring
  - Changes summary generation

- **🎉 Release Pipeline** (`release.yml`): Automated releases
  - Triggered by version tags (e.g., `v1.0.0`)
  - Automatic GitHub Release creation
  - Docker image publishing with semantic versioning
  - Release testing and validation

- **🌙 Nightly Checks** (`nightly.yml`): Daily maintenance
  - Dependency audits and security checks
  - Extended test suites
  - Database migration testing
  - Image size tracking
  - Long-running health monitoring

### Creating a Release

```bash
# Create and push a new version tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# The pipeline automatically:
# 1. Creates a GitHub Release with notes
# 2. Builds and pushes Docker images
# 3. Tags: v1.0.0, 1.0, 1, latest
```

### Pull Request Guidelines

Use conventional commit format for PR titles:
```
<type>(<scope>): <description>

Examples:
  feat: add mission search functionality
  fix(api): resolve mission creation bug
  docs: update API documentation
```

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`

### Container Registry

Docker images are published to GitHub Container Registry:

```bash
# Pull the latest image
docker pull ghcr.io/jordanhubbard/aviation-missions-app:latest

# Pull a specific version
docker pull ghcr.io/jordanhubbard/aviation-missions-app:v1.0.0
```

For detailed CI/CD documentation, see [.github/CICD.md](.github/CICD.md).

## 💾 Data Management

### Database Backup

```bash
# Create backup
make backup

# Restore from backup
make restore BACKUP_FILE=backups/aviation-missions-backup-20231201_120000.tar.gz
```

### Mission Data Format

Missions are structured with:
- **Metadata**: Title, category, difficulty (1-10), pilot experience level
- **Educational**: Objective, mission description, educational rationale
- **Operational**: Route description, suggested waypoints, special challenges
- **Community**: Comments, ratings, completion tracking

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository** on GitHub
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and ensure tests pass
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Mission Contributions

Use the "Submit Mission" feature in the web interface to contribute new missions. All submissions are reviewed by administrators before publication.

### Development Guidelines

- Follow Clojure style conventions
- Write comprehensive tests for new features
- Update documentation for API changes
- Ensure Docker builds pass
- Run linting before submitting PRs

## 🔒 Security

### Security Features
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection
- Secure session management

### Reporting Security Issues

Please report security vulnerabilities privately by:
1. **GitHub Security Advisories**: Use the [Security tab](https://github.com/jordanhubbard/aviation-missions-app/security/advisories) to report vulnerabilities
2. **Email**: Contact the maintainer directly for sensitive issues

### Security Scanning

The project includes automated security scanning:
- **Trivy**: Vulnerability scanning for dependencies and Docker images
- **CodeQL**: Static analysis for security issues
- **Dependabot**: Automated dependency updates

## 📊 Project Status

### Build Status
- **CI/CD Pipeline**: [![CI/CD](https://github.com/jordanhubbard/aviation-missions-app/actions/workflows/ci.yml/badge.svg)](https://github.com/jordanhubbard/aviation-missions-app/actions)
- **Security Scans**: Automated vulnerability scanning on every commit
- **Test Coverage**: Comprehensive backend and frontend testing

### Links
- **Issues**: [Report bugs or request features](https://github.com/jordanhubbard/aviation-missions-app/issues)
- **Discussions**: [Community discussions](https://github.com/jordanhubbard/aviation-missions-app/discussions)
- **Releases**: [View all releases](https://github.com/jordanhubbard/aviation-missions-app/releases)
- **Security**: [Security advisories](https://github.com/jordanhubbard/aviation-missions-app/security)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Jordan Hubbard** ([@jordanhubbard](https://github.com/jordanhubbard))

## 🙏 Acknowledgments

- General aviation community for mission inspiration
- Clojure community for excellent tooling and libraries
- Contributors and testers who help improve the application

## 📞 Support

### Getting Help
- **Documentation**: Check the API documentation at `/swagger.json`
- **Issues**: [Open an issue](https://github.com/jordanhubbard/aviation-missions-app/issues) for bugs or feature requests
- **Discussions**: [Join community discussions](https://github.com/jordanhubbard/aviation-missions-app/discussions)

### FAQ

**Q: How do I add new missions?**
A: Use the "Submit Mission" feature in the web interface. Submissions are reviewed before publication.

**Q: Can I run this on my own server?**
A: Yes! The application is fully containerized and can be deployed anywhere Docker runs.

**Q: How do I backup my data?**
A: Use `make backup` to create database backups. The H2 database files are stored in the `./data/` directory.

**Q: Is there a mobile app?**
A: The web interface is fully responsive and works well on mobile devices. A native mobile app is not currently planned.

---

<div align="center">

**[⬆ Back to Top](#-aviation-mission-management-system)**

Made with ❤️ for the general aviation community

</div>