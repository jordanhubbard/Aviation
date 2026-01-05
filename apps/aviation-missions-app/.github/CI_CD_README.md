# CI/CD Pipeline Documentation

## Overview

This project uses GitHub Actions for Continuous Integration and Continuous Deployment (CI/CD). The pipeline automatically builds, tests, and validates code changes on every push and pull request.

## Workflows

### 1. Main CI/CD Pipeline (`ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

**Jobs:**

#### Lint (Code Quality)
- Runs clj-kondo for Clojure code
- Runs ESLint for JavaScript/React code
- Validates JSON files
- Checks for security vulnerabilities

#### Test Backend
- Builds test Docker image with caching
- Runs Clojure test suite (60 tests, 415 assertions)
- Generates test reports
- Uploads test results

#### Build
- Builds production Docker image
- Uses BuildKit for faster builds
- Implements layer caching
- Uploads image as artifact
- Checks image size

#### Security Scanning
- Runs Trivy vulnerability scanner
- Scans for CRITICAL and HIGH severity issues
- Uploads results to GitHub Security tab
- Checks for hardcoded secrets

#### Integration Tests
- Starts application in Docker
- Tests health endpoint
- Tests API endpoints
- Validates admin authentication
- Cleanup on completion

#### Deploy to Staging
- Runs only on `main` branch pushes
- Downloads built image
- Prepares deployment
- (Add your deployment steps)

#### Create Release
- Runs on version tags (v*)
- Generates changelog
- Creates GitHub release
- Attaches Docker image

#### Performance Tests
- Runs on schedule or manual trigger
- Tests response times
- Tests concurrent load
- Validates performance metrics

**Duration:** ~15-20 minutes

### 2. CodeQL Security Analysis (`codeql.yml`)

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main`
- Weekly schedule (Monday 6am UTC)

**Purpose:**
- Static code analysis
- Security vulnerability detection
- Code quality analysis

**Duration:** ~10-15 minutes

### 3. Dependency Review (`dependency-review.yml`)

**Triggers:**
- Pull requests only

**Purpose:**
- Reviews new dependencies
- Checks for known vulnerabilities
- Validates licenses
- Fails on moderate+ severity

**Duration:** <2 minutes

### 4. Pull Request Checks (`pr-checks.yml`)

**Triggers:**
- PR opened, synchronized, reopened, or edited

**Purpose:**
- Validates PR title format
- Checks PR description
- Verifies linked issues
- Detects breaking changes
- Auto-labels PRs by size and affected files

**Duration:** <5 minutes

### 5. Stale Issue Management (`stale.yml`)

**Triggers:**
- Daily at midnight UTC
- Manual workflow dispatch

**Purpose:**
- Marks stale issues (60 days)
- Marks stale PRs (30 days)
- Auto-closes after 7 days
- Exempts pinned/security/critical items

## Branch Protection Rules

### Main Branch
Recommended settings:
- ✅ Require pull request reviews (1+ approvers)
- ✅ Require status checks to pass:
  - `lint`
  - `test-backend`
  - `build`
  - `security`
  - `integration-test`
- ✅ Require conversation resolution
- ✅ Require signed commits (optional)
- ✅ Include administrators
- ✅ Restrict force pushes
- ✅ Restrict deletions

### Develop Branch
Recommended settings:
- ✅ Require status checks to pass
- ✅ Allow force pushes (for rebasing)
- ⬜ Require pull request reviews (optional)

## Setup Instructions

### 1. Enable GitHub Actions
Actions are automatically enabled for new repositories.

### 2. Configure Secrets
No secrets required for basic functionality. Optional secrets:

```
DOCKER_HUB_USERNAME  # For pushing to Docker Hub
DOCKER_HUB_TOKEN     # Docker Hub access token
DEPLOY_SSH_KEY       # For deployment
SLACK_WEBHOOK        # For notifications
```

### 3. Enable Dependabot
Dependabot is configured in `.github/dependabot.yml`:
- npm dependencies (weekly)
- Docker dependencies (weekly)
- GitHub Actions (weekly)

### 4. Configure Branch Protection
Run these commands (requires `gh` CLI):

```bash
# Install GitHub CLI if needed
brew install gh

# Authenticate
gh auth login

# Set up branch protection for main
gh api repos/jordanhubbard/aviation-missions-app/branches/main/protection \
  --method PUT \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=lint \
  --field required_status_checks[contexts][]=test-backend \
  --field required_status_checks[contexts][]=build \
  --field required_status_checks[contexts][]=security \
  --field required_pull_request_reviews[required_approving_review_count]=1 \
  --field enforce_admins=true \
  --field restrictions=null
```

### 5. Enable Security Features

**GitHub Security Settings:**
1. Go to Settings → Security & analysis
2. Enable:
   - ✅ Dependency graph
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Secret scanning
   - ✅ Code scanning (CodeQL)

## Caching Strategy

### Docker Layer Caching
- Uses GitHub Actions cache
- Stores in `/tmp/.buildx-cache`
- Reduces build time by ~50%
- Cache key includes: OS, stage, SHA

### Leiningen Dependencies
- Cached in Docker layer
- Reused between test runs
- Invalidated on `project.clj` changes

## Artifacts

### Docker Images
- **Retention:** 7 days
- **Size:** ~200-300 MB compressed
- **Format:** tar archive
- **Usage:** Download and load with `docker load`

### Test Reports
- Generated in job summaries
- Viewable in Actions tab
- Includes pass/fail counts

## Notifications

### Success
- ✅ Green checkmark on commits
- GitHub status checks pass

### Failure
- ❌ Red X on commits
- Email notification to commit author
- PR blocks merge

### Security Issues
- 🔒 Security tab alert
- Email notification
- Dependabot creates PR for fixes

## Performance

### Build Times
- Lint: ~3 minutes
- Test Backend: ~8 minutes
- Build: ~10 minutes
- Security: ~5 minutes
- Integration Test: ~5 minutes
- **Total:** ~15-20 minutes

### Optimization
- Parallel job execution
- Docker layer caching
- BuildKit enabled
- Dependency caching

## Troubleshooting

### Tests Failing
1. Check test logs in Actions tab
2. Run tests locally: `make test`
3. Check for environment differences

### Build Failing
1. Review build logs
2. Check Docker layer cache
3. Try rebuilding: `make clean && make build`

### Security Scan Issues
1. Review Trivy results in Security tab
2. Update vulnerable dependencies
3. Check Dependabot PRs

### Cache Issues
1. Clear cache manually from Actions tab
2. Rebuild without cache
3. Check cache size limits (10GB per repo)

## Monitoring

### Action Runs
- View in GitHub Actions tab
- Filter by workflow, branch, or status
- Download logs for debugging

### Security Alerts
- View in Security tab
- Review Dependabot PRs
- Check CodeQL results

### Performance
- Monitor build times
- Review cache hit rates
- Optimize slow jobs

## Best Practices

### Commits
- Write clear commit messages
- Follow conventional commits
- Sign commits (optional)

### Pull Requests
- Use PR template
- Link to issues
- Wait for CI checks
- Request reviews

### Testing
- Write tests for new features
- Maintain test coverage >70%
- Fix failing tests promptly

### Security
- Never commit secrets
- Review Dependabot PRs
- Address security alerts quickly
- Use HTTPS in production

## Maintenance

### Weekly
- Review Dependabot PRs
- Check for failed scheduled jobs
- Monitor security alerts

### Monthly
- Review workflow efficiency
- Update Actions versions
- Clean up old artifacts

### Quarterly
- Review and update branch protection
- Audit security settings
- Update documentation

## Support

For issues with CI/CD:
1. Check workflow logs
2. Review this documentation
3. Open an issue
4. Contact maintainers

## Version History

- **v1.0** (2025-11-23) - Initial CI/CD pipeline
  - Main workflow with 8 jobs
  - CodeQL security scanning
  - Dependency review
  - PR automation
  - Stale issue management

---

*For more information, see the workflow files in `.github/workflows/`*
