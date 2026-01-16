# Aviation Monorepo

[![CI/CD Status](https://github.com/jordanhubbard/Aviation/actions/workflows/ci.yml/badge.svg)](https://github.com/jordanhubbard/Aviation/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive monorepo for aviation-related applications, featuring unified CI/CD, shared infrastructure, and secure secrets management.

## 🏗️ Architecture

This monorepo contains **7 aviation applications** and **3 shared packages** with unified development infrastructure:

- **Unified CI/CD Pipeline** - Automated testing, security scanning, and deployment
- **Secure Secrets Management** - Encrypted keystore for API keys and credentials
- **Automated Dependency Updates** - Dependabot manages all dependencies
- **Shared Infrastructure** - Common packages for keystore, SDK, and UI framework
- **Beads Pattern** - Work organization for parallelism and testability

## 📁 Repository Structure

```
Aviation/
├── apps/                          # Applications
│   ├── aviation-accident-tracker/ # Incident tracking and analysis (TypeScript + React)
│   ├── aviation-missions-app/     # Mission management (Clojure + JS)
│   ├── flight-tracker/            # Real-time flight tracking (TypeScript)
│   ├── flight-planner/            # VFR flight planning (Python + React)
│   ├── flightschool/              # Flight school management (Python Flask)
│   ├── foreflight-dashboard/      # ForeFlight logbook analysis (Python + React)
│   └── weather-briefing/          # Aviation weather briefing (TypeScript)
├── packages/                      # Shared packages
│   ├── keystore/                  # Secure encrypted key management
│   ├── shared-sdk/                # Common SDK and service patterns
│   └── ui-framework/              # Multi-modal UI framework
├── docs/                          # Documentation
├── scripts/                       # Build and utility scripts
├── .github/workflows/             # CI/CD pipeline configuration
└── package.json                   # Monorepo root configuration
```

## 🚀 Quick Start

### Prerequisites

**Required:**
- **Node.js** 20+ and **npm** 9+
- **Python** 3.11+ (for Python apps)
- **Java** 11+ (for Clojure apps)

**Optional (for containerization):**
- Docker and Docker Compose

### Installation

```bash
# Clone the repository
git clone https://github.com/jordanhubbard/Aviation.git
cd Aviation

# Install all dependencies
npm install

# Set up secrets (one-time setup)
npm run keystore:init
```

📚 **For detailed setup instructions, see [Getting Started Guide](docs/GETTING_STARTED.md)**

## 🛠️ Building and Running Applications

### Quick Start with Makefile

The repository includes a top-level Makefile for common tasks:

```bash
# Build everything
make build

# Run all tests
make test

# Clean all build artifacts
make clean

# Show all available targets
make help
```

**Component-specific targets:**
```bash
make build-node      # Build Node.js/TypeScript apps
make build-python    # Build Python apps
make build-clojure   # Build Clojure apps
make test-node       # Test Node.js apps
make test-python     # Test Python apps
make test-clojure    # Test Clojure apps
make clean-node      # Clean Node.js artifacts
make clean-python    # Clean Python artifacts
make clean-clojure   # Clean Clojure artifacts
```

### Building Individual Applications

Each application can also be built and run independently:

#### Aviation Missions App (Clojure + JavaScript)
```bash
cd apps/aviation-missions-app
make build      # Build the application
make start      # Start the server (port 3000)
make test       # Run tests
```

#### Flight Planner (Python + React)
```bash
cd apps/flight-planner
# Backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

#### Flight School (Python Flask)
```bash
cd apps/flightschool
make demo       # Run demo with test data
# OR
make start      # Start production server
```

#### ForeFlight Dashboard (Python + React)
```bash
cd apps/foreflight-dashboard
make start      # Start with Docker Compose
# OR for development:
make dev        # Start backend and frontend separately
```

#### Flight Tracker (TypeScript)
```bash
cd apps/flight-tracker
npm install
npm run build
npm start
```

#### Weather Briefing (TypeScript)
```bash
cd apps/weather-briefing
npm install
npm run build
npm start
```

### Running All Tests

```bash
# From monorepo root
npm test

# Or run CI pipeline locally
.github/workflows/ci.yml  # GitHub Actions will run automatically
```

## 📦 Applications

### [Aviation Accident Tracker](apps/aviation-accident-tracker/)
Comprehensive aviation accident and incident tracking system with automated data ingestion, geospatial visualization, and flexible APIs.

- **Tech Stack:** Node.js, TypeScript, Express, SQLite, React, Leaflet
- **Features:** Automated ingestion (ASN, AVHerald), interactive map, filters, REST & GraphQL APIs, data export
- **Ports:** Backend 3002, Frontend 5173
- **Documentation:** [API Guide](apps/aviation-accident-tracker/API_DOCUMENTATION.md), [GraphQL API](apps/aviation-accident-tracker/GRAPHQL_API.md), [Deployment](apps/aviation-accident-tracker/DEPLOYMENT.md)

### [Aviation Missions App](apps/aviation-missions-app/)
Mission management system for general aviation training with comprehensive catalog, community features, and administrative tools.

- **Tech Stack:** Clojure, Ring, Compojure, H2 Database, JavaScript
- **Features:** Mission catalog, ratings, comments, admin panel
- **Port:** 3000

### [Flight Planner](apps/flight-planner/)
Unified VFR flight planning with route planning, terrain checks, and weather integration.

- **Tech Stack:** Python, FastAPI, React, TypeScript, Leaflet
- **Features:** Route planning, terrain profiles, weather overlays, fuel stops
- **Ports:** Backend 8000, Frontend 5173

### [Flight School](apps/flightschool/)
Flight school management system with student registration, aircraft/instructor management, and booking.

- **Tech Stack:** Python, Flask, SQLite, Bootstrap
- **Features:** Student management, scheduling, aircraft tracking
- **Port:** 5000

### [ForeFlight Dashboard](apps/foreflight-dashboard/)
ForeFlight logbook analysis with CSV import, validation, and statistics visualization.

- **Tech Stack:** Python, FastAPI, React, TypeScript
- **Features:** CSV import, flight validation, statistics, currency tracking
- **Ports:** Backend 8000, Frontend 5173

### [Flight Tracker](apps/flight-tracker/)
Real-time flight tracking service (in development).

- **Tech Stack:** Node.js, TypeScript
- **Port:** 3001

### [Weather Briefing](apps/weather-briefing/)
Aviation weather briefing with AI-powered analysis (in development).

- **Tech Stack:** Node.js, TypeScript
- **Port:** 3002

## 🔐 Secrets Management

All applications use a secure, encrypted keystore for managing API keys and credentials.

### Quick Reference

```bash
# Set a secret
npm run keystore set <service-name> <KEY_NAME> "value"

# Get a secret
npm run keystore get <service-name> <KEY_NAME>

# List all secrets for a service
npm run keystore list <service-name>

# List all services
npm run keystore:services

# Migrate from .env files
npm run secrets:migrate
```

### Using Secrets in Code

**TypeScript:**
```typescript
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('my-service');
const apiKey = secrets.getRequired('API_KEY');
```

**Python:**
```python
from keystore import create_secret_loader

secrets = create_secret_loader('my-service')
api_key = secrets.get_required('API_KEY')
```

**Production:** Set `KEYSTORE_ENCRYPTION_KEY` environment variable for enhanced security.

📚 **For complete documentation, see:**
- [Secrets Quick Start](docs/SECRETS_QUICKSTART.md)
- [Secrets Management Guide](docs/SECRETS_MANAGEMENT.md)
- [Keystore Setup](docs/KEYSTORE_SETUP.md)
- [Application Integration Guide](docs/APP_SECRETS_INTEGRATION.md)

## 🧩 Shared Packages

### [@aviation/keystore](packages/keystore/)
Secure encrypted key management system with TypeScript and Python clients.

### [@aviation/shared-sdk](packages/shared-sdk/)
Common SDK with service patterns and AI methodology.

### [@aviation/ui-framework](packages/ui-framework/)
Multi-modal UI framework supporting mobile, web, and multi-tab interfaces.

## 📖 Documentation

### Getting Started
- [Getting Started Guide](docs/GETTING_STARTED.md) - Initial setup and first steps
- [Architecture Overview](docs/ARCHITECTURE.md) - System architecture and design
- [Migration Guide](docs/MIGRATION.md) - Migrating from standalone repos

### Development
- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [Agents Guide](AGENTS.md) - Guidelines for LLM agents and automation

### Security
- [Security Guide](docs/SECURITY.md) - Security best practices
- [Security Summary](docs/SECURITY_SUMMARY.md) - Security features overview
- [Secrets Management](docs/SECRETS_MANAGEMENT.md) - Complete secrets guide

### Design
- [UI Modalities](docs/UI_MODALITIES.md) - UI design patterns
- [Color Scheme](docs/COLOR_SCHEME.md) - Visual design guidelines

## 🔧 Development Workflows

### Creating a New Application

1. **Create directory structure:**
   ```bash
   mkdir -p apps/my-app/src
   cd apps/my-app
   ```

2. **Add package.json with workspace dependencies:**
   ```json
   {
     "name": "@aviation/my-app",
     "dependencies": {
       "@aviation/shared-sdk": "workspace:*",
       "@aviation/keystore": "workspace:*"
     }
   }
   ```

3. **Create beads.yaml for work organization:**
   ```yaml
   beads:
     - name: my-feature
       description: Feature description
       dependencies: []
       parallel: true
   ```

4. **Add tests and documentation**

### Running CI/CD Locally

The CI/CD pipeline runs automatically on push and pull requests, but you can test locally:

```bash
# Validate beads configuration
python validate_beads.py

# Run linting
npm run lint

# Run tests for all apps
npm test

# Check accessibility and color contrast
npm run check:contrast
```

## 🤖 Automated Workflows

### Dependabot
Automated dependency updates run weekly:
- **Monday:** GitHub Actions, npm root, TypeScript packages
- **Tuesday-Friday:** Individual applications

### Security Scanning
- **CodeQL** - Static analysis for vulnerabilities
- **Trivy** - Container security scanning
- **GitGuardian** - Secret detection in commits

### CI/CD Pipeline
Runs on every push and pull request:
- ✅ Beads validation
- ✅ Linting and formatting
- ✅ Unit and integration tests
- ✅ Security scanning
- ✅ Accessibility checks
- ✅ Build verification

## 📝 Code Style

### Python
- **Formatter:** Black (88 char line length)
- **Type Hints:** Required
- **Docstrings:** Required for public APIs
- **Testing:** pytest with 80%+ coverage

### TypeScript/JavaScript
- **Formatter:** Prettier
- **Linting:** ESLint with strict mode
- **Style:** Functional components with hooks
- **Testing:** Vitest/Jest with 80%+ coverage

### Clojure
- **Formatter:** cljfmt
- **Testing:** clojure.test

## 🐳 Docker Support

Most applications include Docker support for containerized deployment:

```bash
cd apps/<app-name>
docker-compose up --build
```

## 📊 CI/CD Status

View the latest CI/CD runs: [GitHub Actions](https://github.com/jordanhubbard/Aviation/actions)

All applications are tested on every commit with:
- Unit tests
- Integration tests
- Security scans
- Linting and type checking
- Accessibility validation

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for:
- Code style guidelines
- Development workflow
- Testing requirements
- Pull request process
- Beads pattern usage

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Repository:** https://github.com/jordanhubbard/Aviation
- **CI/CD:** https://github.com/jordanhubbard/Aviation/actions
- **Security Alerts:** https://github.com/jordanhubbard/Aviation/security/dependabot
- **Issues:** https://github.com/jordanhubbard/Aviation/issues

---

**Questions?** Open an issue or check the [documentation](docs/).
