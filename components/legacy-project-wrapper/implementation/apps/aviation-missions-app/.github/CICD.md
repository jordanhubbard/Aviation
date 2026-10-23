# 🚀 CI/CD Pipeline Documentation

This document describes the comprehensive CI/CD pipeline for the Aviation Missions Application.

## 📋 Table of Contents

- [Overview](#overview)
- [Workflows](#workflows)
- [Setup Instructions](#setup-instructions)
- [Deployment](#deployment)
- [Badges](#badges)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The CI/CD pipeline is built with GitHub Actions and provides:

- ✅ Automated testing on every push and pull request
- 🔍 Code quality analysis (linting)
- 🐳 Docker image building and pushing
- 🔒 Security scanning
- 📦 Automated releases
- 🌙 Nightly health checks

## 🔄 Workflows

### 1. Main CI/CD Pipeline (`ci.yml`)

**Triggers:** Push to `main` or `develop`, Pull Requests

**Jobs:**

#### Lint (🔍 Code Quality Analysis)
- Runs `clj-kondo` on Clojure code
- Validates JavaScript syntax
- Ensures code quality standards

#### Backend Tests (🧪 Backend Unit Tests)
- Sets up Java 21 and Leiningen
- Runs full Clojure test suite
- Uploads test artifacts

#### Docker Test (🐳 Docker Build & Test)
- Builds Docker images (testing and production targets)
- Starts application container
- Tests health endpoint
- Tests API endpoints (`/api/missions`, `/api/swagger.json`)
- Tests mission creation functionality
- Validates frontend accessibility

#### Docker Build (🐳 Docker Build & Push)
- Only runs on `main`/`develop` branches (not PRs)
- Builds multi-platform images (amd64, arm64)
- Pushes to GitHub Container Registry
- Tags: `main-SHA`, `develop-SHA`, `latest` (for main only)

#### Security Scan (🔒 Security Scanning)
- Uses Trivy to scan Docker images
- Checks for CRITICAL and HIGH vulnerabilities
- Uploads results to GitHub Security tab
- Non-blocking (exit-code: 0)

#### Deploy (🚀 Deploy to Production)
- Only runs on `main` branch after successful tests
- Requires `production` environment approval
- Placeholder for deployment logic (Railway, AWS, etc.)

**Example Usage:**
```bash
# Automatically runs on:
git push origin main
git push origin develop

# Or via pull request:
gh pr create --base main
```

### 2. Pull Request Validation (`pr-check.yml`)

**Triggers:** Pull request opened, synchronized, or reopened

**Jobs:**

#### PR Validation
- Validates PR title format (conventional commits)
- Checks for large files (>5MB)
- Scans for potential secrets

#### Quick Test
- Fast compilation check
- Runs critical tests only
- Provides rapid feedback

#### Size Check
- Monitors Docker image size
- Warns if image exceeds 500MB

#### Changes Summary
- Generates statistics about changes
- Lists modified files
- Categorizes changes by language

**Conventional Commit Format:**
```
<type>(<scope>): <description>

Examples:
  feat: add mission search functionality
  fix(api): resolve mission creation bug
  docs: update API documentation
  test: add integration tests for missions
```

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`

### 3. Release Pipeline (`release.yml`)

**Triggers:** Git tags matching `v*.*.*` (e.g., `v1.0.0`)

**Jobs:**

#### Create Release
- Extracts version from tag
- Generates release notes from commits
- Creates GitHub Release

#### Build and Push
- Builds multi-platform Docker images
- Pushes with semantic version tags
- Tags: `v1.0.0`, `1.0`, `1`, `latest`

#### Test Release
- Pulls and tests release image
- Validates health and functionality

**Creating a Release:**
```bash
# Create and push a new tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# The pipeline will automatically:
# 1. Create a GitHub Release
# 2. Build and push Docker images
# 3. Test the release
```

### 4. Nightly Checks (`nightly.yml`)

**Triggers:** 
- Scheduled (daily at 2 AM UTC)
- Manual trigger via workflow_dispatch

**Jobs:**

#### Dependency Audit
- Checks for outdated Clojure dependencies
- Runs security audit

#### Extended Tests
- Full test suite with coverage
- Performance tests

#### Database Migration Test
- Tests fresh database initialization
- Validates database persistence across container restarts

#### Image Size Tracking
- Monitors image size trends
- Provides layer analysis

#### Health Monitoring
- Runs application for 5 minutes
- Performs regular health checks
- Ensures stability

**Manual Trigger:**
```bash
gh workflow run nightly.yml
```

## 🛠️ Setup Instructions

### Prerequisites

1. **Enable GitHub Container Registry**
   - Go to Settings → Packages
   - Enable package creation

2. **Required Permissions**
   - Workflows have `contents: read`, `packages: write`
   - No additional secrets needed for basic CI/CD

### Optional: Production Environment

1. Create a production environment:
   - Go to Settings → Environments
   - Create `production` environment
   - Add protection rules (require reviewers)

2. Add deployment secrets (if needed):
   - `RAILWAY_TOKEN` - For Railway deployments
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - For AWS
   - Custom deployment tokens

### GitHub Container Registry Access

Pull images from GitHub Container Registry:

```bash
# Authenticate
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull image
docker pull ghcr.io/OWNER/REPO:latest
```

## 🚢 Deployment

### Deploying to Railway

1. Add `RAILWAY_TOKEN` secret to repository
2. Uncomment deployment code in `ci.yml`:

```yaml
- name: Deploy to production
  run: |
    curl -X POST https://railway.app/api/v1/deployments \
      -H "Authorization: Bearer ${{ secrets.RAILWAY_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{"image": "${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest"}'
```

### Deploying to AWS ECS

```yaml
- name: Deploy to AWS ECS
  uses: aws-actions/amazon-ecs-deploy-task-definition@v1
  with:
    task-definition: task-definition.json
    service: aviation-missions-service
    cluster: production-cluster
```

### Deploying to Kubernetes

```yaml
- name: Deploy to Kubernetes
  run: |
    kubectl set image deployment/aviation-missions \
      aviation-missions=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
```

## 🏅 Badges

Add these badges to your README.md:

```markdown
![CI/CD Pipeline](https://github.com/USERNAME/REPO/workflows/CI%2FCD%20Pipeline/badge.svg)
![Pull Request Validation](https://github.com/USERNAME/REPO/workflows/Pull%20Request%20Validation/badge.svg)
![Nightly Checks](https://github.com/USERNAME/REPO/workflows/Nightly%20Checks/badge.svg)
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Docker Build Fails

**Problem:** Docker build fails with "manifest unknown"

**Solution:**
```bash
# Clean Docker cache
docker builder prune -f

# Rebuild from scratch
docker build --no-cache -t aviation-missions:latest .
```

#### 2. Tests Fail in CI but Pass Locally

**Problem:** Tests pass locally but fail in CI

**Possible Causes:**
- Different Java versions
- Missing environment variables
- Timing issues

**Solution:**
```bash
# Run tests with same Java version as CI (Java 21)
lein test

# Check environment
env | grep -i java
```

#### 3. Image Size Too Large

**Problem:** Docker image exceeds size warnings

**Solution:**
- Use multi-stage builds (already implemented)
- Remove unnecessary dependencies
- Use `.dockerignore` to exclude files

#### 4. Authentication Errors with GHCR

**Problem:** Cannot push to GitHub Container Registry

**Solution:**
- Ensure `packages: write` permission is set
- Check repository settings → Actions → General → Workflow permissions
- Enable "Read and write permissions"

### Debug Mode

Enable debug logging in workflows:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

### Manual Workflow Run

Run any workflow manually:

```bash
# Using GitHub CLI
gh workflow run ci.yml

# Or via GitHub UI
# Actions → Select workflow → Run workflow
```

## 📊 Monitoring

### View Workflow Status

```bash
# List recent workflow runs
gh run list --workflow=ci.yml

# View specific run
gh run view RUN_ID

# View logs
gh run view RUN_ID --log
```

### Artifacts

Test results and artifacts are uploaded for 7 days:
- Backend test results
- Docker build logs
- Security scan reports

Access via: Actions → Workflow Run → Artifacts

## 🔐 Security

### Secrets Management

Never commit secrets to the repository. Use GitHub Secrets:

```bash
# Add a secret via CLI
gh secret set SECRET_NAME

# Or via UI: Settings → Secrets → Actions → New secret
```

### Dependency Updates

Dependabot is configured to automatically:
- Check for dependency updates weekly
- Create PRs for updates
- Group related updates

See `.github/dependabot.yml` for configuration.

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

---

**Last Updated:** 2025-11-24

For questions or issues with CI/CD, please open an issue or contact the maintainers.
