# AGENTS.md - LLM-Friendly Repository Guidelines

This document provides comprehensive guidelines for LLM agents working with this aviation monorepo. It follows best practices for making codebases easy to understand and work with for both humans and AI assistants.

---

## Table of Contents

1. [Repository Overview](#repository-overview)
2. [Adding New Aviation Applications](#adding-new-aviation-applications)
3. [Meta App Integration (Multi-Tab UI)](#meta-app-integration-multi-tab-ui)
4. [CI/CD: Always Ensure Green](#cicd-always-ensure-green)
5. [Programming Languages & Dependencies](#programming-languages--dependencies)
6. [Monorepo Best Practices](#monorepo-best-practices)
7. [Aviation SDK & Shared Tools](#aviation-sdk--shared-tools)
8. [Application-Specific Best Practices](#application-specific-best-practices)
9. [Work Organization with Beads](#work-organization-with-beads)
10. [Security & Secrets Management](#security--secrets-management)
11. [Development Workflows](#development-workflows)
12. [Testing Strategy](#testing-strategy)
13. [Documentation Standards](#documentation-standards)
14. [Common Tasks Quick Reference](#common-tasks-quick-reference)

---

## Repository Overview

This is a monorepo containing **6 aviation applications** and **3 shared packages**:

```
Aviation/
├── apps/                          # Applications
│   ├── aviation-missions-app/     # Mission management (Clojure + JS)
│   ├── flight-tracker/            # Flight tracking (TypeScript)
│   ├── flight-planner/            # VFR planning (Python + React)
│   ├── flightschool/              # Flight school mgmt (Python Flask)
│   ├── foreflight-dashboard/      # Logbook analysis (Python + React)
│   └── weather-briefing/          # Weather briefing (TypeScript)
├── packages/                      # Shared packages
│   ├── keystore/                  # Encrypted key management
│   ├── shared-sdk/                # Common SDK and patterns
│   └── ui-framework/              # Multi-modal UI framework
├── docs/                          # All user-facing documentation
├── scripts/                       # Build and utility scripts
├── .github/workflows/             # CI/CD pipeline
├── AGENTS.md                      # This file - LLM guidelines
├── CONTRIBUTING.md                # Development guidelines
├── README.md                      # Repository overview
└── LICENSE                        # MIT License
```

### Architecture Principles

1. **Modular Services**: Each aviation application is self-contained
2. **Shared Infrastructure**: Common functionality via shared packages
3. **Security First**: Encrypted keystore for API keys and secrets
4. **Multi-Modal UI**: Support for web, mobile, and multi-tab interfaces
5. **Polyglot**: Multiple languages optimized for each use case

---

## Adding New Aviation Applications

### Step-by-Step Process

#### 1. Create Application Structure

```bash
# From monorepo root
mkdir -p apps/my-aviation-app/src
cd apps/my-aviation-app
```

#### 2. Choose Your Tech Stack

Based on the application's requirements:

**Python + React** (for data-intensive apps like flight-planner, foreflight-dashboard):
```
my-aviation-app/
├── backend/
│   ├── app/                    # Application code
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI/Flask entry point
│   │   └── services/          # Business logic
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── tests/
├── beads.yaml                  # Work organization
├── Makefile                    # Build commands
└── README.md
```

**TypeScript Service** (for real-time services like flight-tracker, weather-briefing):
```
my-aviation-app/
├── src/
│   ├── index.ts               # Entry point
│   ├── service.ts             # Background service
│   └── api/                   # API routes
├── beads.yaml
├── Makefile
├── package.json
├── tsconfig.json
└── README.md
```

**Clojure + JavaScript** (for specialized applications like aviation-missions-app):
```
my-aviation-app/
├── backend/
│   ├── src/
│   │   └── my_app/            # Clojure namespaces
│   ├── test/
│   └── project.clj            # Leiningen config
├── frontend/
│   └── resources/
│       └── public/
├── beads.yaml
├── Makefile
└── README.md
```

#### 3. Create package.json (for TypeScript/Node.js apps)

```json
{
  "name": "@aviation/my-aviation-app",
  "version": "0.1.0",
  "description": "Description of your aviation app",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "jest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@aviation/shared-sdk": "*",
    "@aviation/keystore": "*",
    "@aviation/ui-framework": "*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

#### 4. Create beads.yaml

Define the work organization (see [Work Organization with Beads](#work-organization-with-beads)):

```yaml
version: "1.0"

beads:
  # Core service
  - name: core-service
    description: Main service logic
    path: src/service.ts
    dependencies: []
    parallel: true
    test_path: tests/service.test.ts
    
  # API layer
  - name: api
    description: REST API endpoints
    path: src/api/
    dependencies: [core-service]
    parallel: false
    test_path: tests/api.test.ts
    
  # Frontend (if applicable)
  - name: frontend
    description: User interface
    path: frontend/src/
    dependencies: []
    parallel: true
    
execution_groups:
  - name: initial
    beads: [core-service, frontend]
  - name: integration
    beads: [api]
    depends_on: [initial]

ci:
  test_strategy: parallel
  max_parallel: 3
```

#### 5. Create Makefile

Standardize build commands:

```makefile
.PHONY: help build clean test start stop

help:
	@echo "Available targets:"
	@echo "  make build  - Build the application"
	@echo "  make test   - Run tests"
	@echo "  make start  - Start the application"
	@echo "  make stop   - Stop the application"
	@echo "  make clean  - Clean build artifacts"

build:
	npm install
	npm run build

test:
	npm test

start:
	npm start

stop:
	pkill -f "node.*my-aviation-app" || true

clean:
	rm -rf dist node_modules
```

#### 6. Add to Root package.json Workspace

Edit `/Users/jkh/Src/Aviation/package.json`:

```json
{
  "workspaces": [
    "packages/*",
    "apps/*",
    "apps/my-aviation-app"
  ]
}
```

#### 7. Create README.md

Document your application (see [Documentation Standards](#documentation-standards)):

```markdown
# My Aviation App

> Part of the [Aviation Monorepo](../../README.md)

## Description
Brief description of what your app does.

## Quick Start
\`\`\`bash
cd apps/my-aviation-app
make build
make start
\`\`\`

## Features
- Feature 1
- Feature 2

## Tech Stack
- List technologies used

## Development
Instructions for local development.

## Testing
How to run tests.
```

#### 8. Add Secrets Configuration

```bash
# Set up secrets for your service
npm run keystore set my-aviation-app API_KEY "your-api-key"
npm run keystore set my-aviation-app SECRET_KEY "your-secret"
```

#### 9. Implement the Application

**TypeScript Example:**

```typescript
// src/service.ts
import { BackgroundService } from '@aviation/shared-sdk';
import { createSecretLoader } from '@aviation/keystore';

export class MyAviationService extends BackgroundService {
  private secrets = createSecretLoader('my-aviation-app');

  protected async onStart(): Promise<void> {
    console.log('Starting My Aviation Service...');
    const apiKey = this.secrets.getRequired('API_KEY');
    // Initialize your service
  }

  protected async onStop(): Promise<void> {
    console.log('Stopping My Aviation Service...');
    // Cleanup
  }
}

// src/index.ts
import { MyAviationService } from './service';

const service = new MyAviationService({
  name: 'my-aviation-app',
  enabled: true,
  autoStart: true
});

service.start();
```

**Python Example:**

```python
# backend/main.py
from fastapi import FastAPI
from app_secrets import create_secret_loader

app = FastAPI(title="My Aviation App")
secrets = create_secret_loader('my-aviation-app')

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/data")
def get_data():
    api_key = secrets.get_required('API_KEY')
    # Your logic here
    return {"data": []}
```

#### 10. Add Tests

```typescript
// tests/service.test.ts
import { MyAviationService } from '../src/service';

describe('MyAviationService', () => {
  let service: MyAviationService;

  beforeEach(() => {
    service = new MyAviationService({
      name: 'test-service',
      enabled: true
    });
  });

  test('should start successfully', async () => {
    await service.start();
    expect(service.getStatus()).toBe('running');
  });
});
```

#### 11. Update Root Makefile

Add your app to the root Makefile:

```makefile
# Add to appropriate sections
run-my-aviation-app:
	@echo "🚀 Starting My Aviation App..."
	cd apps/my-aviation-app && $(MAKE) start
```

#### 12. Register with CI/CD

The app will be automatically picked up by CI/CD if:
- It has a `beads.yaml` file (validated by `python validate_beads.py`)
- It has test scripts defined in `package.json` or `Makefile`
- Tests are in standard locations (`tests/`, `test/`)

#### 13. Update Documentation

Add your app to the root README.md:

```markdown
### [My Aviation App](apps/my-aviation-app/)
Brief description of the app.

- **Tech Stack:** Python, FastAPI, React, TypeScript
- **Features:** Key features
- **Port:** 3003
```

---

## Meta App Integration (Multi-Tab UI)

The monorepo supports a "meta app" pattern where all aviation applications can be displayed as tabs in a single web interface using the `@aviation/ui-framework` package.

### Making Your App Multi-Tab Compatible

#### 1. Create a Pane Component

```typescript
// apps/my-aviation-app/src/ui/pane.tsx
export function MyAviationAppPane() {
  return (
    <div className="my-aviation-app-pane">
      <h2>My Aviation App</h2>
      <div className="app-content">
        {/* Your application UI */}
      </div>
    </div>
  );
}
```

#### 2. Export from package.json

```json
{
  "name": "@aviation/my-aviation-app",
  "exports": {
    ".": "./dist/index.js",
    "./ui": "./dist/ui/pane.js"
  }
}
```

#### 3. Register with Meta App

Create or update `apps/meta-app/src/App.tsx`:

```typescript
import { MultiTabWebUI } from '@aviation/ui-framework';
import { FlightTrackerPane } from '@aviation/flight-tracker/ui';
import { WeatherPane } from '@aviation/weather-briefing/ui';
import { MyAviationAppPane } from '@aviation/my-aviation-app/ui';

const webUI = new MultiTabWebUI();

// Register all application panes
webUI.registerPane({
  id: 'flight-tracker',
  title: 'Flight Tracker',
  icon: '✈️',
  component: FlightTrackerPane,
  order: 1
});

webUI.registerPane({
  id: 'weather',
  title: 'Weather',
  icon: '🌤️',
  component: WeatherPane,
  order: 2
});

webUI.registerPane({
  id: 'my-aviation-app',
  title: 'My Aviation App',
  icon: '🛩️',
  component: MyAviationAppPane,
  order: 3
});

// Initialize and render
function MetaApp() {
  return (
    <div className="meta-app">
      <TabNavigation panes={webUI.getAllPanes()} />
      <PaneContainer activePane={webUI.getActivePane()} />
    </div>
  );
}
```

### Keeping Apps Standalone

Applications remain **fully standalone** by design:

#### 1. Separate Entry Points

```
my-aviation-app/
├── src/
│   ├── index.ts              # Standalone entry point
│   ├── service.ts            # Backend service (shared)
│   ├── standalone-ui.tsx     # Standalone web UI
│   └── ui/
│       └── pane.tsx          # Meta app pane component
```

#### 2. Dual Build Configuration

```json
// package.json
{
  "scripts": {
    "build": "npm run build:service && npm run build:ui",
    "build:service": "tsc --project tsconfig.service.json",
    "build:ui": "vite build",
    "build:pane": "tsc --project tsconfig.pane.json",
    "start:standalone": "npm run build && node dist/index.js",
    "dev:standalone": "concurrently \"tsc --watch\" \"vite\""
  }
}
```

#### 3. Independent Deployment

Each app can be deployed standalone with Docker:

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY public ./public

EXPOSE 3003
CMD ["node", "dist/index.js"]
```

#### 4. Meta App as Optional Consumer

The meta app is just another consumer of your application:

```
┌──────────────────────────────────────────┐
│          Your Aviation App               │
│  ┌────────────────────────────────────┐ │
│  │      Backend Service               │ │
│  │  (Always independent)              │ │
│  └────────────────────────────────────┘ │
│           ↑              ↑                │
│           │              │                │
│  ┌────────┴───────┐  ┌──┴──────────────┐│
│  │  Standalone UI │  │  Pane Component ││
│  │  (Optional)    │  │  (Optional)     ││
│  └────────────────┘  └─────────────────┘│
│                           ↓               │
│                    ┌──────────────────┐  │
│                    │    Meta App      │  │
│                    │  (Consumer only) │  │
│                    └──────────────────┘  │
└──────────────────────────────────────────┘
```

### Best Practices for Dual-Mode Apps

1. **Shared Business Logic**: Keep all business logic in the service layer
2. **UI Adapters**: Create thin UI adapters for each mode
3. **API First**: Design APIs that work for both modes
4. **State Management**: Use consistent state management
5. **Configuration**: Use environment variables or configuration files to switch modes

---

## CI/CD: Always Ensure Green

### Pre-Commit Quality Gates

**MANDATORY**: Before every commit and push, run these commands to ensure CI/CD will pass:

#### Quick Pre-Commit Check

```bash
# From monorepo root
make ci-check
```

Or manually run each step:

#### 1. Validate Beads Configuration

```bash
python validate_beads.py
```

**Expected Output:**
```
✅ All applications have valid beads configuration!
```

**If it fails**: Fix your `beads.yaml` files to resolve validation errors.

#### 2. Run All Tests

```bash
# Run all tests across all applications
make test

# Or test specific tech stacks
make test-node       # TypeScript/JavaScript tests
make test-python     # Python tests
make test-clojure    # Clojure tests
```

**Expected**: All tests pass with 0 failures.

**If tests fail**: Fix the failing tests before committing.

#### 3. Run Linters and Formatters

```bash
# Check all code style
npm run lint

# Auto-fix issues
npm run format

# Python apps
black apps/*/app apps/*/backend --check
flake8 apps/*/app apps/*/backend

# Auto-fix Python
black apps/*/app apps/*/backend
```

**Expected**: All linters pass with 0 errors, 0 warnings.

#### 4. Check Color Contrast (Accessibility)

```bash
./scripts/check-all-contrast.sh
```

**Expected**: All color combinations meet WCAG AA standards.

#### 5. Type Check (TypeScript apps)

```bash
# Check TypeScript types
cd apps/my-typescript-app
npm run type-check
```

**Expected**: 0 type errors.

#### 6. Build Verification

```bash
# Verify all apps build successfully
make build
```

**Expected**: All builds complete without errors.

### Automated CI/CD Pipeline

The CI/CD pipeline (`.github/workflows/ci.yml`) runs automatically on:
- Every push to `main` or `develop`
- Every pull request

**Pipeline Stages:**

1. **Validate Beads** - Validates all `beads.yaml` files
2. **Accessibility** - Checks WCAG AA color contrast
3. **Test Applications** - Runs tests for each app:
   - `test-missions-app` - Clojure backend tests
   - `test-flight-planner` - Python backend + TypeScript frontend
   - `test-flightschool` - Python Flask tests
   - `test-foreflight` - Python backend + React frontend
4. **Lint & Format** - Code style checks (Black, Prettier, ESLint)
5. **Security Scan** - Trivy vulnerability scanning
6. **Build Check** - Verifies all apps can build

### "Always Green" Rules

**CRITICAL RULES:**

1. ✅ **Never merge failing CI/CD** - All checks must pass
2. ✅ **Run pre-commit checks** - Use `make ci-check` before every push
3. ✅ **Fix broken builds immediately** - Don't leave main branch broken
4. ✅ **Keep tests passing** - Don't commit code that breaks existing tests
5. ✅ **Maintain 80%+ coverage** - Add tests for new code
6. ✅ **No linter errors** - Clean code only
7. ✅ **Validate beads** - All `beads.yaml` files must be valid

### Local CI/CD Simulation

Run the exact same checks that CI/CD runs:

```bash
# Create a script: scripts/ci-check-local.sh
#!/bin/bash
set -e

echo "🔍 Running CI/CD checks locally..."

echo "1. Validating beads configuration..."
python validate_beads.py

echo "2. Checking color contrast..."
./scripts/check-all-contrast.sh

echo "3. Running tests..."
make test-node
make test-python
make test-clojure

echo "4. Linting..."
npm run lint

echo "5. Building..."
make build

echo "✅ All CI/CD checks passed!"
```

Make it executable and run:

```bash
chmod +x scripts/ci-check-local.sh
./scripts/ci-check-local.sh
```

### Adding CI/CD for New Applications

New applications are **automatically** included in CI/CD if they follow the standard structure:

1. **Have a `beads.yaml` file** - Will be validated automatically
2. **Have test scripts** - `npm test` or `pytest` or `lein test`
3. **Follow naming conventions** - Tests in `tests/` or `test/` directory
4. **Have a Makefile** - With standard targets (`build`, `test`, `clean`)

To add custom CI/CD steps, edit `.github/workflows/ci.yml`:

```yaml
test-my-app:
  name: Test My Aviation App
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - name: Set up Node.js
      uses: actions/setup-node@v6
      with:
        node-version: '20'
    
    - name: Install dependencies
      working-directory: apps/my-aviation-app
      run: npm ci
    
    - name: Run tests
      working-directory: apps/my-aviation-app
      run: npm test
```

### Debugging CI/CD Failures

When CI/CD fails:

1. **Check the GitHub Actions tab** - See which specific job failed
2. **Look at the error logs** - Identify the specific failure
3. **Reproduce locally** - Run the exact same command that failed
4. **Fix the issue** - Make the necessary changes
5. **Verify locally** - Ensure the fix works with `make ci-check`
6. **Push the fix** - CI/CD will automatically re-run

Common failures:

| Error | Cause | Fix |
|-------|-------|-----|
| "beads.yaml not found" | Missing beads configuration | Add `beads.yaml` to your app |
| "Test failed" | Failing unit/integration tests | Fix the failing tests |
| "Lint errors" | Code style violations | Run `npm run format` or `black` |
| "Type error" | TypeScript type issues | Fix type errors, run `npm run type-check` |
| "Build failed" | Compilation errors | Fix syntax errors, ensure dependencies installed |
| "Color contrast" | Accessibility issues | Adjust colors to meet WCAG AA standards |

---

## Programming Languages & Dependencies

### Language Summary

This monorepo uses **5 programming languages**, each chosen for specific strengths:

| Language | Used In | Purpose | Version |
|----------|---------|---------|---------|
| **Python** | 3 apps | Data processing, ML, APIs | 3.11+ |
| **TypeScript** | 2 apps + packages | Type-safe services, SDKs | 5.0+ |
| **JavaScript** | 2 apps + frontends | UI development, legacy code | ES2020+ |
| **Clojure** | 1 app | Functional programming, JVM | 1.11+ |
| **Bash** | Scripts | Build automation, DevOps | 5.0+ |

### Detailed Dependency Inventory

#### Python Applications

**Common Python Dependencies:**
```
# Backend frameworks
fastapi==0.110.0              # Modern API framework (flight-planner, foreflight-dashboard)
uvicorn==0.27.1               # ASGI server
Flask==2.3.3                  # Traditional web framework (flightschool)

# Data processing
pandas==2.2.1                 # Data manipulation
numpy>=1.24.0                 # Numerical computing
geopandas>=0.14.0             # Geospatial data (flight-planner)
shapely>=2.0.0                # Geometric operations

# Validation
pydantic==2.12.5              # Data validation
pydantic-settings>=2.0        # Settings management

# Database
sqlalchemy>=2.0.16            # ORM (flightschool, foreflight-dashboard)
Flask-SQLAlchemy==3.1.1       # Flask integration
Flask-Migrate==4.1.0          # Database migrations

# Authentication
Flask-Login==0.6.3            # User session management
passlib[bcrypt]==1.7.4        # Password hashing
PyJWT==2.10.1                 # JWT tokens

# HTTP & async
httpx>=0.25.0                 # Async HTTP client
requests>=2.31.0              # Synchronous HTTP client
aiofiles>=23.0                # Async file operations

# Google APIs (flightschool)
google-auth==2.41.0           # Google authentication
google-api-python-client==2.187.0  # Google Calendar API

# Utilities
python-dotenv==1.0.1          # Environment variables
pytz==2025.2                  # Timezone handling
python-dateutil==2.8.2        # Date utilities

# Testing
pytest==9.0.2                 # Testing framework
pytest-asyncio==0.23.5        # Async test support
pytest-cov==7.0.0             # Coverage reporting
pytest-mock==3.12.0           # Mocking

# Code quality
black==25.12.0                # Code formatter
flake8==7.0.0                 # Linter
mypy>=1.7                     # Type checker
```

**App-Specific Dependencies:**

*flight-planner:*
- `geopandas` - Geospatial route planning
- `shapely` - Geometric calculations

*flightschool:*
- `Flask-WTF==1.2.2` - Form handling
- `Flask-Mail==0.10.0` - Email functionality
- `google-api-python-client` - Google Calendar integration

*foreflight-dashboard:*
- `slowapi==0.1.9` - Rate limiting
- `factory-boy==3.3.0` - Test fixtures
- `faker==24.0.0` - Fake data generation

#### TypeScript/JavaScript Applications

**Common Node.js Dependencies:**
```json
{
  "typescript": "^5.0.0",        // Type safety
  "@types/node": "^20.0.0",      // Node.js types
  
  // React (frontends)
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^7.11.0",
  
  // Build tools
  "vite": "^7.3.0",              // Fast bundler
  "vitest": "^4.0.16",           // Testing
  "@vitejs/plugin-react": "^5.1.2",
  
  // UI libraries
  "@mui/material": "^5.15.0",    // Material UI
  "@mui/icons-material": "^5.15.0",
  "@emotion/react": "^11.11.1",
  "@emotion/styled": "^11.11.0",
  
  // Forms & validation
  "react-hook-form": "^7.48.2",
  "@hookform/resolvers": "^5.2.2",
  "yup": "^1.4.0",
  
  // Data fetching
  "axios": "^1.6.2",
  "react-query": "^3.39.3",
  
  // Maps (flight-planner)
  "leaflet": "^1.9.4",
  "react-leaflet": "^4.2.1",
  
  // State management
  "zustand": "^4.4.7",
  
  // Testing
  "@testing-library/react": "^13.4.0",
  "@testing-library/jest-dom": "^6.1.5",
  "@playwright/test": "^1.50.0",
  
  // Code quality
  "eslint": "^8.55.0",
  "@typescript-eslint/eslint-plugin": "^6.14.0",
  "prettier": "^3.4.2"
}
```

**TypeScript Services** (flight-tracker, weather-briefing):
```json
{
  "@aviation/shared-sdk": "*",
  "@aviation/keystore": "*",
  "@aviation/ui-framework": "*"
}
```

#### Clojure Applications

**aviation-missions-app:**
```clojure
;; project.clj
:dependencies [
  [org.clojure/clojure "1.11.1"]
  
  ;; Web framework
  [ring/ring-core "1.11.0"]
  [ring/ring-jetty-adapter "1.11.0"]
  [ring/ring-json "0.5.1"]
  [compojure "1.7.0"]
  
  ;; JSON handling
  [cheshire "5.12.0"]
  
  ;; Database
  [com.h2database/h2 "2.2.224"]
  [org.clojure/java.jdbc "0.7.12"]
  [honeysql "1.0.461"]
  
  ;; Security
  [buddy/buddy-hashers "1.8.158"]
  
  ;; Utilities
  [ring-cors "0.1.13"]
  [clj-time "0.15.2"]
  [clj-commons/clj-yaml "1.0.29"]
  
  ;; API documentation
  [metosin/ring-swagger "0.26.2"]
  [metosin/compojure-api "2.0.0-alpha31"]
  
  ;; Logging
  [org.clojure/tools.logging "1.2.4"]
  [ch.qos.logback/logback-classic "1.4.14"]
]

;; Testing
:profiles {:test {:dependencies [[ring/ring-mock "0.4.0"]]}}
```

#### Shared Packages

**@aviation/keystore:**
- Core encryption library
- AES-256-CBC implementation
- Node.js `crypto` module

**@aviation/shared-sdk:**
- Base classes for services
- AI integration patterns
- Minimal dependencies (pure TypeScript)

**@aviation/ui-framework:**
- Multi-modal UI abstractions
- React integration (peer dependency)
- Minimal dependencies

### Runtime Requirements

| Component | Requirement | Version |
|-----------|-------------|---------|
| **Node.js** | Required for TypeScript apps, build tools | 20+ |
| **npm** | Package manager | 9+ |
| **Python** | Required for Python apps | 3.11+ |
| **pip** | Python package manager | Latest |
| **Java** | Required for Clojure apps | 17+ |
| **Leiningen** | Clojure build tool | 2.10+ |
| **Docker** | Optional, for containerization | 24+ |
| **Docker Compose** | Optional, for multi-container apps | 2.20+ |
| **make** | Build automation | Any recent version |

### Development Tools

```
# Required for all developers
git                  # Version control
make                 # Build automation

# Language-specific
nvm                  # Node version manager
pyenv                # Python version manager
venv/virtualenv      # Python virtual environments

# Optional but recommended
docker               # Containerization
docker-compose       # Multi-container orchestration
jq                   # JSON processing
curl/httpie          # API testing
```

### Installation Quickstart

**macOS:**
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install all requirements
brew install node python@3.11 openjdk@17 leiningen docker docker-compose make

# Install Node packages
cd /path/to/Aviation
npm install
```

**Ubuntu/Debian:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install Java
sudo apt install -y openjdk-17-jdk

# Install Leiningen
sudo bash -c "cd /usr/local/bin && curl -fsSLO https://raw.githubusercontent.com/technomancy/leiningen/stable/bin/lein && chmod a+x lein"

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install packages
cd /path/to/Aviation
npm install
```

**Windows (WSL2):**
```bash
# Use the Ubuntu instructions above in WSL2
# Or use Windows-native tools:
# - Node.js: https://nodejs.org/
# - Python: https://www.python.org/downloads/windows/
# - Java: https://adoptium.net/
# - Docker Desktop: https://www.docker.com/products/docker-desktop/
```

---

## Monorepo Best Practices

### Security Best Practices

#### 1. Never Commit Secrets

**CRITICAL**: Never commit these files:
- `.env` files with real secrets
- `.keystore` file (encrypted secrets)
- API keys in code
- Passwords or tokens
- Private keys

**Verify before commit:**
```bash
# Check for secrets
git diff --staged | grep -E "(API_KEY|SECRET|PASSWORD|TOKEN)" && echo "⚠️  Possible secret detected!"

# Install git-secrets
brew install git-secrets
git secrets --install
git secrets --register-aws
```

#### 2. Use Keystore for All Secrets

```typescript
// ✅ CORRECT: Use keystore
import { createSecretLoader } from '@aviation/keystore';
const secrets = createSecretLoader('my-app');
const apiKey = secrets.getRequired('API_KEY');

// ❌ WRONG: Hardcoded secrets
const apiKey = 'sk-abc123xyz';

// ❌ WRONG: Direct env access (less secure)
const apiKey = process.env.API_KEY;
```

#### 3. Set Production Encryption Key

```bash
# Generate secure key
openssl rand -base64 32

# Set in production environment
export KEYSTORE_ENCRYPTION_KEY="your-generated-key-here"
```

#### 4. Restrict File Permissions

   ```bash
# Keystore file (if using in production)
chmod 600 .keystore

# Scripts with sensitive operations
chmod 700 scripts/deploy.sh
```

#### 5. Regular Security Audits

```bash
# Node.js dependencies
npm audit
npm audit fix

# Python dependencies
pip install safety
safety check

# Security scanning (automated in CI/CD)
# Trivy scans all Docker images
# CodeQL scans all code
```

### Common Tools & Utilities

#### Aviation Data Sources

Create shared utilities for common aviation data:

```typescript
// packages/shared-sdk/src/aviation/airports.ts
export interface Airport {
  icao: string;
  iata: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
}

export class AirportDatabase {
  private airports: Map<string, Airport>;

  constructor() {
    // Load from shared data file
    this.airports = this.loadAirports();
  }

  findByIcao(icao: string): Airport | undefined {
    return this.airports.get(icao);
  }

  searchByName(query: string): Airport[] {
    // Fuzzy search implementation
  }

  findNearby(lat: number, lon: number, radiusNm: number): Airport[] {
    // Geospatial search
  }
}
```

#### METAR/TAF Parsing

```typescript
// packages/shared-sdk/src/aviation/weather.ts
export interface METAR {
  station: string;
  time: Date;
  wind: {
    direction: number;
    speed: number;
    gust?: number;
  };
  visibility: number;
  temperature: number;
  dewpoint: number;
  altimeter: number;
  conditions: string[];
}

export class WeatherParser {
  parseMetar(raw: string): METAR {
    // METAR parsing logic (shared across apps)
  }

  parseTaf(raw: string): TAF {
    // TAF parsing logic
  }
}
```

#### Distance Calculations

```typescript
// packages/shared-sdk/src/aviation/navigation.ts
export class Navigation {
  /**
   * Calculate great circle distance between two coordinates
   * @returns Distance in nautical miles
   */
  static distance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 3440.065; // Earth radius in NM
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate true course between two coordinates
   * @returns Course in degrees (0-360)
   */
  static course(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const dLon = this.toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(this.toRad(lat2));
    const x =
      Math.cos(this.toRad(lat1)) * Math.sin(this.toRad(lat2)) -
      Math.sin(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.cos(dLon);
    const brng = Math.atan2(y, x);
    return (this.toDeg(brng) + 360) % 360;
  }

  private static toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private static toDeg(radians: number): number {
    return radians * (180 / Math.PI);
  }
}
```

#### Fuel Calculations

```typescript
// packages/shared-sdk/src/aviation/fuel.ts
export interface FuelBurn {
  gallons: number;
  pounds: number;
  timeHours: number;
}

export class FuelCalculator {
  /**
   * Calculate fuel required for a flight
   * @param distanceNm Distance in nautical miles
   * @param groundSpeedKts Ground speed in knots
   * @param fuelBurnGph Fuel burn rate in gallons per hour
   * @param fuelWeightLbs Weight per gallon (default: 6.0 for 100LL)
   * @returns Fuel burn calculation
   */
  static calculateFuelBurn(
    distanceNm: number,
    groundSpeedKts: number,
    fuelBurnGph: number,
    fuelWeightLbs: number = 6.0
  ): FuelBurn {
    const timeHours = distanceNm / groundSpeedKts;
    const gallons = timeHours * fuelBurnGph;
    const pounds = gallons * fuelWeightLbs;

    return { gallons, pounds, timeHours };
  }

  /**
   * Calculate weight and balance
   */
  static weightAndBalance(
    emptyWeight: number,
    emptyArm: number,
    stations: Array<{ weight: number; arm: number }>
  ): { totalWeight: number; cgArm: number; moment: number } {
    let totalWeight = emptyWeight;
    let totalMoment = emptyWeight * emptyArm;

    for (const station of stations) {
      totalWeight += station.weight;
      totalMoment += station.weight * station.arm;
    }

    const cgArm = totalMoment / totalWeight;

    return { totalWeight, cgArm, moment: totalMoment };
  }
}
```

#### E6B Computer Functions

```typescript
// packages/shared-sdk/src/aviation/e6b.ts
export class E6B {
  /**
   * Calculate true airspeed from indicated airspeed
   */
  static trueAirspeed(
    indicatedAirspeedKts: number,
    altitudeFt: number,
    temperatureC: number
  ): number {
    // TAS calculation accounting for altitude and temperature
    const standardTemp = 15 - 0.00198 * altitudeFt;
    const tempDiff = temperatureC - standardTemp;
    const correction = 1 + (0.0117 * tempDiff / 100);
    return indicatedAirspeedKts * Math.sqrt(correction);
  }

  /**
   * Calculate ground speed and heading with wind correction
   */
  static windCorrection(
    trueAirspeedKts: number,
    trueCourse: number,
    windDirection: number,
    windSpeedKts: number
  ): { groundSpeed: number; trueHeading: number; windCorrectionAngle: number } {
    // Wind triangle calculation
    const tcRad = (trueCourse * Math.PI) / 180;
    const wdRad = (windDirection * Math.PI) / 180;

    const ws = windSpeedKts;
    const tas = trueAirspeedKts;

    // Calculate wind components
    const headwind = ws * Math.cos(wdRad - tcRad);
    const crosswind = ws * Math.sin(wdRad - tcRad);

    // Calculate ground speed
    const groundSpeed = Math.sqrt(
      Math.pow(tas + headwind, 2) + Math.pow(crosswind, 2)
    );

    // Calculate wind correction angle
    const windCorrectionAngle = Math.atan2(crosswind, tas) * (180 / Math.PI);

    // Calculate true heading
    const trueHeading = (trueCourse + windCorrectionAngle + 360) % 360;

    return { groundSpeed, trueHeading, windCorrectionAngle };
  }

  /**
   * Calculate density altitude
   */
  static densityAltitude(
    pressureAltitudeFt: number,
    temperatureC: number
  ): number {
    const standardTemp = 15 - 0.00198 * pressureAltitudeFt;
    const tempDiff = temperatureC - standardTemp;
    return pressureAltitudeFt + (120 * tempDiff);
  }

  /**
   * Calculate pressure altitude from altimeter setting
   */
  static pressureAltitude(
    indicatedAltitudeFt: number,
    altimeterSettingInHg: number
  ): number {
    return indicatedAltitudeFt + (29.92 - altimeterSettingInHg) * 1000;
  }
}
```

### Shared API Clients

Create reusable API clients:

```typescript
// packages/shared-sdk/src/api/aviation-weather.ts
import { createSecretLoader } from '@aviation/keystore';

export class AviationWeatherClient {
  private apiKey: string;
  private baseUrl = 'https://api.aviationweather.gov';

  constructor(serviceName: string) {
    const secrets = createSecretLoader(serviceName);
    this.apiKey = secrets.get('AVIATION_WEATHER_API_KEY') || '';
  }

  async getMetar(station: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/data/metar?ids=${station}&format=raw`,
      {
        headers: { 'X-API-Key': this.apiKey }
      }
    );
    return response.text();
  }

  async getTaf(station: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/data/taf?ids=${station}&format=raw`,
      {
        headers: { 'X-API-Key': this.apiKey }
      }
    );
    return response.text();
  }
}
```

### Logging Standards

Standardize logging across applications:

```typescript
// packages/shared-sdk/src/logging/logger.ts
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  metadata?: Record<string, any>;
}

export class Logger {
  constructor(private serviceName: string) {}

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      metadata,
    };

    // Output as JSON for structured logging
    console.log(JSON.stringify(entry));
  }
}
```

### Error Handling Patterns

```typescript
// packages/shared-sdk/src/errors/aviation-errors.ts
export class AviationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'AviationError';
  }
}

export class AirportNotFoundError extends AviationError {
  constructor(icao: string) {
    super(
      `Airport not found: ${icao}`,
      'AIRPORT_NOT_FOUND',
      404,
      { icao }
    );
    this.name = 'AirportNotFoundError';
  }
}

export class WeatherUnavailableError extends AviationError {
  constructor(station: string, reason?: string) {
    super(
      `Weather unavailable for ${station}${reason ? `: ${reason}` : ''}`,
      'WEATHER_UNAVAILABLE',
      503,
      { station, reason }
    );
    this.name = 'WeatherUnavailableError';
  }
}

export class FlightPlanValidationError extends AviationError {
  constructor(message: string, validationErrors: string[]) {
    super(
      message,
      'FLIGHT_PLAN_VALIDATION_ERROR',
      400,
      { validationErrors }
    );
    this.name = 'FlightPlanValidationError';
  }
}
```

---

## Aviation SDK & Shared Tools

### Overview

The `@aviation/shared-sdk` package provides common patterns, utilities, and base classes for all aviation applications.

### Core Components

#### 1. Background Services

Base class for long-running services:

```typescript
// packages/shared-sdk/src/service.ts
import { BackgroundService, ServiceConfig } from '@aviation/shared-sdk';

export class FlightTrackerService extends BackgroundService {
  protected async onStart(): Promise<void> {
    console.log('Flight tracker starting...');
    // Initialize tracking
    this.schedulePeriodicUpdates();
  }

  protected async onStop(): Promise<void> {
    console.log('Flight tracker stopping...');
    // Cleanup resources
    this.cancelScheduledTasks();
  }

  private schedulePeriodicUpdates(): void {
    setInterval(() => {
      this.updateFlightData();
    }, 30000); // Every 30 seconds
  }

  private async updateFlightData(): Promise<void> {
    // Update logic
  }
}
```

#### 2. Aviation Data Types

```typescript
// packages/shared-sdk/src/aviation/types.ts
export interface Position {
  latitude: number;
  longitude: number;
  altitude?: number; // feet MSL
}

export interface Flight {
  callsign: string;
  aircraft: {
    type: string;
    registration: string;
  };
  departure: string; // ICAO
  destination: string; // ICAO
  alternate?: string; // ICAO
  route: Position[];
  estimatedTimeEnroute: number; // minutes
  fuelOnBoard: number; // gallons
}

export interface FlightPlan {
  flight: Flight;
  filedTime: Date;
  departureTime: Date;
  cruiseAltitude: number; // feet
  cruiseSpeed: number; // knots TAS
  remarks?: string;
}

export interface NavAid {
  id: string;
  type: 'VOR' | 'NDB' | 'DME' | 'TACAN' | 'FIX';
  name: string;
  position: Position;
  frequency?: number;
  variation?: number; // magnetic variation
}

export interface Airspace {
  id: string;
  name: string;
  type: 'CLASS_A' | 'CLASS_B' | 'CLASS_C' | 'CLASS_D' | 'CLASS_E' | 'SPECIAL_USE';
  floor: number; // feet MSL
  ceiling: number; // feet MSL
  geometry: GeoJSON.Polygon;
}
```

#### 3. API Response Types

```typescript
// packages/shared-sdk/src/api/responses.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, any>
): ApiResponse<never> {
  return {
    success: false,
    error: { code, message, details },
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };
}
```

#### 4. Validation Utilities

```typescript
// packages/shared-sdk/src/validation/aviation-validators.ts
export class AviationValidators {
  /**
   * Validate ICAO airport code
   */
  static isValidIcao(code: string): boolean {
    return /^[A-Z]{4}$/.test(code);
  }

  /**
   * Validate IATA airport code
   */
  static isValidIata(code: string): boolean {
    return /^[A-Z]{3}$/.test(code);
  }

  /**
   * Validate aircraft registration (N-number)
   */
  static isValidNNumber(registration: string): boolean {
    return /^N[0-9]{1,5}[A-Z]{0,2}$/.test(registration);
  }

  /**
   * Validate altitude (MSL or flight level)
   */
  static isValidAltitude(altitude: number): boolean {
    return altitude >= -2000 && altitude <= 60000;
  }

  /**
   * Validate heading (0-360)
   */
  static isValidHeading(heading: number): boolean {
    return heading >= 0 && heading < 360;
  }

  /**
   * Validate speed (knots)
   */
  static isValidSpeed(speed: number): boolean {
    return speed > 0 && speed <= 1000;
  }

  /**
   * Validate coordinates
   */
  static isValidCoordinate(lat: number, lon: number): boolean {
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }
}
```

### Usage Examples

#### Creating an Aviation Service

```typescript
// apps/my-aviation-app/src/service.ts
import { BackgroundService } from '@aviation/shared-sdk';
import { createSecretLoader } from '@aviation/keystore';
import { Logger } from '@aviation/shared-sdk';

export class MyAviationService extends BackgroundService {
  private logger = new Logger('my-aviation-app');
  private secrets = createSecretLoader('my-aviation-app');

  protected async onStart(): Promise<void> {
    this.logger.info('Starting aviation service...');
    
    const apiKey = this.secrets.getRequired('API_KEY');
    
    // Initialize your service
    await this.initialize(apiKey);
    
    this.logger.info('Aviation service started successfully');
  }

  protected async onStop(): Promise<void> {
    this.logger.info('Stopping aviation service...');
    
    // Cleanup
    await this.cleanup();
    
    this.logger.info('Aviation service stopped');
  }

  private async initialize(apiKey: string): Promise<void> {
    // Initialization logic
  }

  private async cleanup(): Promise<void> {
    // Cleanup logic
  }
}
```

#### Using Aviation Data Types

```typescript
// apps/flight-tracker/src/flight-data.ts
import { Flight, Position } from '@aviation/shared-sdk';

export async function trackFlight(callsign: string): Promise<Flight> {
  const flightData = await fetchFlightData(callsign);
  
  const flight: Flight = {
    callsign: flightData.callsign,
    aircraft: {
      type: flightData.aircraft_type,
      registration: flightData.registration,
    },
    departure: flightData.origin,
    destination: flightData.destination,
    route: flightData.positions.map((pos: any) => ({
      latitude: pos.lat,
      longitude: pos.lon,
      altitude: pos.alt,
    })),
    estimatedTimeEnroute: flightData.ete,
    fuelOnBoard: flightData.fob,
  };
  
  return flight;
}
```

---

## Application-Specific Best Practices

### Aviation Missions App (Clojure)

**Key Patterns:**

1. **Ring Middleware Stack:**
```clojure
(def app
  (-> handler
      wrap-params
      wrap-keyword-params
      wrap-json-body
      wrap-json-response
      wrap-cors
      wrap-session))
```

2. **Database Migrations:**
- Use `honeysql` for query generation
- Keep migrations in version control
- Test migrations on copies of production data

3. **API Documentation:**
- Use `ring-swagger` for OpenAPI/Swagger
- Keep API docs in sync with code
- Provide interactive documentation at `/swagger.json`

4. **Error Handling:**
```clojure
(defn safe-handler [handler]
  (fn [request]
    (try
      (handler request)
      (catch Exception e
        (log/error e "Request failed")
        {:status 500
         :body {:error "Internal server error"}}))))
```

### Flight Planner (Python + React)

**Key Patterns:**

1. **FastAPI Best Practices:**
```python
# Use dependency injection
from fastapi import Depends, FastAPI

app = FastAPI()

async def get_airport_service() -> AirportService:
    return AirportService()

@app.get("/api/airports/{icao}")
async def get_airport(
    icao: str,
    service: AirportService = Depends(get_airport_service)
):
    return await service.find_airport(icao)
```

2. **Geospatial Data:**
- Use `geopandas` for geospatial operations
- Cache frequently accessed geospatial data
- Use spatial indexing for performance

3. **Terrain Data:**
- Cache terrain elevation data
- Use OpenTopography API with rate limiting
- Implement graceful degradation when terrain unavailable

4. **Route Planning:**
- Calculate great circle routes
- Account for airspace restrictions
- Consider fuel stops for long routes
- Apply wind correction

### Flight School (Python Flask)

**Key Patterns:**

1. **Flask-SQLAlchemy Models:**
```python
class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    aircraft_id = db.Column(db.Integer, db.ForeignKey('aircraft.id'))
    instructor_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    
    # Prevent double booking
    __table_args__ = (
        db.CheckConstraint('start_time < end_time'),
    )
```

2. **Booking Validation:**
- Check aircraft availability
- Check instructor availability
- Validate time ranges
- Prevent overlapping bookings

3. **Calendar Integration:**
- Sync with Google Calendar
- Handle timezone conversions properly
- Display current time in booking UI

4. **Role-Based Access:**
```python
from flask_login import login_required
from functools import wraps

def admin_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.is_admin:
            abort(403)
        return f(*args, **kwargs)
    return decorated_function

@app.route('/admin/users')
@admin_required
def admin_users():
    return render_template('admin/users.html')
```

### ForeFlight Dashboard (Python + React)

**Key Patterns:**

1. **CSV Import Validation:**
```python
def validate_foreflight_csv(df: pd.DataFrame) -> List[str]:
    errors = []
    
    # Check required columns
    required = ['Date', 'Aircraft ID', 'From', 'To', 'Total Time']
    missing = set(required) - set(df.columns)
    if missing:
        errors.append(f"Missing columns: {missing}")
    
    # Validate ICAO codes
    for col in ['From', 'To']:
        invalid = df[~df[col].str.match(r'^[A-Z]{4}$')]
        if not invalid.empty:
            errors.append(f"Invalid {col} codes: {invalid[col].tolist()}")
    
    return errors
```

2. **Night Flight Detection:**
- Calculate sunset/sunrise times
- Determine if flights are night flights
- Visual distinction (purple background)

3. **Cross-Country Validation:**
- Check distance > 50nm
- Verify landings at different airports
- Validate day vs. night XC

4. **Statistics Dashboard:**
- Real-time calculation of totals
- Currency tracking (night, XC, instrument)
- Visual charts with MUI components

### TypeScript Services (Flight Tracker, Weather Briefing)

**Key Patterns:**

1. **Service Lifecycle:**
```typescript
export class FlightTrackerService extends BackgroundService {
  private updateInterval?: NodeJS.Timer;

  protected async onStart(): Promise<void> {
    this.updateInterval = setInterval(
      () => this.updateFlights(),
      30000
    );
  }

  protected async onStop(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}
```

2. **Error Recovery:**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

3. **API Client Pattern:**
```typescript
export class WeatherApiClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  async getMetar(station: string): Promise<string> {
    return withRetry(async () => {
      const response = await fetch(
        `${this.baseUrl}/metar/${station}`,
        {
          headers: { 'X-API-Key': this.apiKey }
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.text();
    });
  }
}
```

---

## Work Organization with Beads

### What are Beads?

Beads are independent, composable units of work that enable:
1. **Parallel execution** - Multiple beads can run simultaneously
2. **Independent testing** - Each bead has its own test suite
3. **Team collaboration** - Different teams work on different beads
4. **Clear dependencies** - Bead relationships are explicit

### Bead Structure

```yaml
version: "1.0"

beads:
  # Define each bead
  - name: bead-name
    description: What this bead does
    path: src/path/to/code.ts
    dependencies: [other-bead]  # Optional
    parallel: true              # Can run in parallel?
    test_path: tests/bead_test.ts

# Define execution groups
execution_groups:
  - name: group-name
    beads: [bead1, bead2]
    depends_on: [other-group]

# CI/CD integration
ci:
  test_strategy: parallel
  max_parallel: 4
  test_groups:
    - name: unit-tests
      beads: [bead1, bead2]
```

### Best Practices for Beads

1. **Keep beads small and focused** - Each bead should do one thing well
2. **Minimize dependencies** - Fewer dependencies = more parallelism
3. **Test each bead independently** - Don't rely on other beads in tests
4. **Document dependencies** - Make relationships explicit
5. **Use execution groups** - Organize related beads together

### Validating Beads

```bash
# Validate all beads.yaml files
python validate_beads.py

# Checks for:
# - Valid YAML syntax
# - Path existence
# - Dependency validity
# - Circular dependencies
# - Execution group consistency
```

---

## Security & Secrets Management

### Keystore System

All secrets are stored in an encrypted `.keystore` file using AES-256-CBC encryption.

#### Setting Secrets

```bash
# Set a secret
npm run keystore set <service-name> <KEY_NAME> "value"

# Examples
npm run keystore set flight-planner OPENWEATHERMAP_API_KEY "abc123"
npm run keystore set foreflight-dashboard SECRET_KEY "xyz789"
```

#### Using Secrets in Code

**TypeScript:**
```typescript
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('my-service');

// Get a secret (returns undefined if not found)
const apiKey = secrets.get('API_KEY');

// Get a required secret (throws if not found)
const secretKey = secrets.getRequired('SECRET_KEY');

// Get with default value
const port = secrets.getWithDefault('PORT', '3000');
```

**Python:**
```python
from app_secrets import create_secret_loader

secrets = create_secret_loader('my-service')

# Get a secret (returns None if not found)
api_key = secrets.get('API_KEY')

# Get a required secret (raises error if not found)
secret_key = secrets.get_required('SECRET_KEY')

# Get with default value
port = secrets.get_with_default('PORT', '5000')
```

#### Production Security

```bash
# Generate secure encryption key
openssl rand -base64 32

# Set in production environment
export KEYSTORE_ENCRYPTION_KEY="your-generated-key-here"

# Restrict file permissions
chmod 600 .keystore
```

### Security Checklist

- [ ] Never commit `.env` files with secrets
- [ ] Never commit `.keystore` file
- [ ] Set `KEYSTORE_ENCRYPTION_KEY` in production
- [ ] Use keystore for all sensitive configuration
- [ ] Restrict file permissions (`chmod 600`)
- [ ] Rotate secrets regularly
- [ ] Review security scan results in GitHub Security tab
- [ ] Keep dependencies updated (Dependabot runs weekly)

---

## Development Workflows

### Starting a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes
# Edit code, add tests, update docs

# 3. Run quality checks
python validate_beads.py
make test
npm run lint

# 4. Commit changes
git add .
git commit -m "feat(app-name): description"

# 5. Push and create PR
git push origin feature/my-feature
# Open PR on GitHub
```

### Local Development

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run specific app in development mode
cd apps/my-app
make dev

# Watch for changes
npm run dev  # TypeScript apps
# OR
make watch   # Apps with Makefile support
```

### Docker Development

```bash
# Build Docker image
cd apps/my-app
docker-compose build

# Start services
docker-compose up

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Hot Reloading

**TypeScript apps:**
```json
{
  "scripts": {
    "dev": "tsc --watch & nodemon dist/index.js"
  }
}
```

**Python apps:**
```bash
# FastAPI
uvicorn backend.main:app --reload

# Flask
FLASK_ENV=development flask run
```

**React apps:**
```bash
# Vite
npm run dev

# Uses Vite's built-in HMR
```

---

## Testing Strategy

### Test Organization

```
app-name/
├── tests/                    # All tests
│   ├── unit/                # Unit tests
│   │   ├── test_service.py
│   │   └── test_utils.py
│   ├── integration/         # Integration tests
│   │   ├── test_api.py
│   │   └── test_database.py
│   └── e2e/                 # End-to-end tests (frontend)
│       └── app.spec.ts
```

### Testing Standards

#### Python Tests

```python
# tests/unit/test_airport_service.py
import pytest
from app.services.airport_service import AirportService

@pytest.fixture
def airport_service():
    return AirportService()

def test_find_airport_by_icao(airport_service):
    airport = airport_service.find_by_icao('KSFO')
    assert airport is not None
    assert airport.icao == 'KSFO'
    assert airport.name == 'San Francisco International Airport'

def test_find_airport_not_found(airport_service):
    with pytest.raises(AirportNotFoundError):
        airport_service.find_by_icao('XXXX')
```

Run tests:
```bash
# All tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific test file
pytest tests/unit/test_airport_service.py -v

# Specific test function
pytest tests/unit/test_airport_service.py::test_find_airport_by_icao -v
```

#### TypeScript Tests

```typescript
// tests/service.test.ts
import { FlightTrackerService } from '../src/service';

describe('FlightTrackerService', () => {
  let service: FlightTrackerService;

  beforeEach(() => {
    service = new FlightTrackerService({
      name: 'test-service',
      enabled: true,
    });
  });

  afterEach(async () => {
    if (service.getStatus() === 'running') {
      await service.stop();
    }
  });

  test('should start successfully', async () => {
    await service.start();
    expect(service.getStatus()).toBe('running');
  });

  test('should stop successfully', async () => {
    await service.start();
    await service.stop();
    expect(service.getStatus()).toBe('stopped');
  });
});
```

Run tests:
```bash
# All tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Specific test file
npm test -- service.test.ts
```

#### React Component Tests

```typescript
// components/__tests__/FlightCard.test.tsx
import { render, screen } from '@testing-library/react';
import { FlightCard } from '../FlightCard';

describe('FlightCard', () => {
  const mockFlight = {
    callsign: 'UAL123',
    departure: 'KSFO',
    destination: 'KJFK',
    aircraft: { type: 'B738', registration: 'N12345' },
  };

  test('renders flight information', () => {
    render(<FlightCard flight={mockFlight} />);
    
    expect(screen.getByText('UAL123')).toBeInTheDocument();
    expect(screen.getByText('KSFO')).toBeInTheDocument();
    expect(screen.getByText('KJFK')).toBeInTheDocument();
  });

  test('displays aircraft information', () => {
    render(<FlightCard flight={mockFlight} />);
    
    expect(screen.getByText('B738')).toBeInTheDocument();
    expect(screen.getByText('N12345')).toBeInTheDocument();
  });
});
```

Run tests:
```bash
# All component tests
npm test

# With UI
npm run test:ui

# E2E tests (Playwright)
npm run e2e
```

### Coverage Requirements

- **Target**: 80%+ code coverage
- **Critical paths**: 100% coverage (authentication, payments, safety-critical)
- **Utilities**: 90%+ coverage
- **UI components**: 70%+ coverage (harder to test comprehensively)

### Continuous Testing

```bash
# Watch mode for rapid iteration
npm test -- --watch           # TypeScript
pytest --watch                # Python (requires pytest-watch)
```

---

## Documentation Standards

### Documentation Organization

**CRITICAL RULES:**

1. **Top-Level Files** (ONLY these):
   - `README.md` - Main repository overview
   - `AGENTS.md` - This file (LLM guidelines)
   - `CONTRIBUTING.md` - Development guidelines
   - `LICENSE` - MIT License

2. **User-Facing Documentation** - `docs/` directory:
   - Setup guides, tutorials, architecture
   - Examples: `docs/KEYSTORE_SETUP.md`, `docs/ARCHITECTURE.md`

3. **Application Documentation** - In each app directory:
   - `apps/app-name/README.md` - App overview
   - `apps/app-name/docs/` - App-specific guides (optional)

### Writing Good Documentation

#### README.md Structure

```markdown
# Application Name

> Part of the [Aviation Monorepo](../../README.md)

Brief one-sentence description.

## Quick Start
\`\`\`bash
# Minimal steps to get running
\`\`\`

## Features
- Feature 1
- Feature 2

## Tech Stack
- List of technologies

## Installation
Step-by-step setup instructions.

## Usage
How to use the application.

## API Reference (if applicable)
Document your API endpoints.

## Development
How to develop locally.

## Testing
How to run tests.

## Deployment
Deployment instructions.

## License
MIT
```

#### Code Comments

**Python:**
```python
def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth.
    
    Args:
        lat1: Starting latitude in degrees
        lon1: Starting longitude in degrees
        lat2: Ending latitude in degrees
        lon2: Ending longitude in degrees
    
    Returns:
        Distance in nautical miles
    
    Example:
        >>> calculate_distance(37.7749, -122.4194, 40.7128, -74.0060)
        2095.8
    """
    # Implementation
```

**TypeScript:**
```typescript
/**
 * Calculate the great circle distance between two points on Earth.
 * 
 * @param lat1 - Starting latitude in degrees
 * @param lon1 - Starting longitude in degrees
 * @param lat2 - Ending latitude in degrees
 * @param lon2 - Ending longitude in degrees
 * @returns Distance in nautical miles
 * 
 * @example
 * ```typescript
 * const distance = calculateDistance(37.7749, -122.4194, 40.7128, -74.0060);
 * console.log(distance); // 2095.8
 * ```
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Implementation
}
```

#### API Documentation

Use OpenAPI/Swagger:

```python
# Python (FastAPI)
@app.get(
    "/api/airports/{icao}",
    response_model=Airport,
    summary="Get airport by ICAO code",
    description="Retrieve detailed information about an airport by its ICAO code",
    responses={
        200: {"description": "Airport found"},
        404: {"description": "Airport not found"},
    }
)
async def get_airport(icao: str):
    """
    Get airport information by ICAO code.
    
    - **icao**: Four-letter ICAO airport code (e.g., KSFO)
    """
    return await airport_service.find_by_icao(icao)
```

---

## Common Tasks Quick Reference

### Secrets Management

```bash
# List all services
npm run keystore services

# List secrets for a service
npm run keystore list my-app

# Get a secret
npm run keystore get my-app API_KEY

# Set a secret
npm run keystore set my-app API_KEY "value"

# Delete a secret
npm run keystore delete my-app OLD_KEY

# Migrate from .env files
npm run secrets:migrate
```

### Building

```bash
# Build everything
make build

# Build specific components
make build-node       # Node.js/TypeScript apps
make build-python     # Python apps (prepares environment)
make build-clojure    # Clojure apps

# Build specific app
cd apps/my-app && make build
```

### Testing

```bash
# Run all tests
make test

# Test specific stack
make test-node
make test-python
make test-clojure

# Test specific app
cd apps/my-app && make test

# With coverage
pytest --cov=src --cov-report=html
npm test -- --coverage
```

### Running Applications

```bash
# Run specific app
make run-aviation-missions
make run-flight-planner
make run-flight-school
make run-foreflight-dashboard
make run-flight-tracker
make run-weather-briefing

# Stop all applications
make stop-all
```

### CI/CD Checks

```bash
# Validate beads configuration
python validate_beads.py

# Check color contrast
./scripts/check-all-contrast.sh

# Run all CI checks locally
make ci-check  # If available
# OR manually:
python validate_beads.py && ./scripts/check-all-contrast.sh && make test && npm run lint
```

### Dependency Management

```bash
# Install all dependencies
npm install

# Update dependencies (monorepo root)
npm update

# Update specific app
cd apps/my-app
npm update                # Node.js
pip install -U -r requirements.txt  # Python
lein update-in :dependencies  # Clojure
```

### Linting & Formatting

```bash
# JavaScript/TypeScript
npm run lint              # Check only
npm run format            # Auto-fix

# Python
black apps/*/app apps/*/backend  # Format
flake8 apps/*/app apps/*/backend  # Lint
mypy apps/*/app apps/*/backend    # Type check

# Clojure
cd apps/aviation-missions-app
make lint                 # Full linting
make lint-fast            # Quick check
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Stage changes
git add .

# Commit with conventional commit format
git commit -m "feat(app-name): add new feature"

# Push and create PR
git push origin feature/my-feature

# Types: feat, fix, docs, style, refactor, test, chore
```

### Docker

```bash
# Build image
cd apps/my-app
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Clean up
docker-compose down -v --rmi all
```

### Adding New Application (Checklist)

- [ ] Create app directory under `apps/`
- [ ] Add `package.json` (if TypeScript) or `requirements.txt` (if Python)
- [ ] Create `beads.yaml` for work organization
- [ ] Add `Makefile` with standard targets
- [ ] Create `README.md` with documentation
- [ ] Implement the application code
- [ ] Add tests (aim for 80%+ coverage)
- [ ] Add secrets to keystore
- [ ] Add to root `package.json` workspaces
- [ ] Add to root `Makefile` run targets
- [ ] Update root `README.md` with app description
- [ ] Verify CI/CD picks it up (check GitHub Actions)
- [ ] Create multi-tab pane component (optional)
- [ ] Test locally: `make build && make test`
- [ ] Commit and push

---

## Questions?

For questions about this monorepo structure or conventions, please:
1. Check existing code for examples
2. Review the [CONTRIBUTING.md](CONTRIBUTING.md) guide
3. Check [documentation in docs/](docs/)
4. Open a GitHub issue for clarification

**Remember**: This monorepo is designed for both humans and AI agents. Keep it clean, documented, and maintainable. Always ensure green CI/CD before merging!

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
