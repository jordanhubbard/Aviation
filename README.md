# Aviation Monorepo

A monorepo for aviation-themed applications running as background services with shared SDK and secure key management.

## Architecture

This monorepo contains multiple aviation applications that share common infrastructure:

### Core Features

- **Background Services**: Each application runs as a background service
- **Secure Key Store**: Centralized, encrypted storage for API keys and secrets
- **Multi-Modal UI**: Applications can run as:
  - Self-contained mobile applications
  - Multi-tab web interface with distinct panes
  - Standalone web applications
- **Shared AI SDK**: Common AI methodology and patterns across all applications

## Structure

```
Aviation/
├── packages/                    # Shared packages
│   ├── shared-sdk/             # Common SDK with AI methodology and service base classes
│   ├── keystore/               # Secure key store for API keys
│   └── ui-framework/           # UI framework supporting multiple modalities
├── apps/                       # Aviation applications
│   ├── aviation-missions-app/  # Aviation mission management system (Clojure + JS)
│   ├── flight-tracker/         # Real-time flight tracking service
│   ├── flightplanner/          # VFR flight planning with weather and terrain (Python + React)
│   ├── flightschool/           # Flight school management system (Python Flask)
│   ├── foreflight-dashboard/   # ForeFlight logbook analysis web app
│   └── weather-briefing/       # Aviation weather briefing with AI analysis
└── package.json                # Monorepo root configuration
```

## Getting Started

### Prerequisites

- Node.js 20+ 
- npm 9+ (or pnpm for better workspace support)

### Installation

```bash
# Install dependencies for all packages
npm install

# Build all packages
npm run build
```

### Running Applications

Each application can be run independently:

#### Node.js/TypeScript Applications

```bash
# Flight Tracker
cd apps/flight-tracker
npm run build
npm start

# Weather Briefing
cd apps/weather-briefing
npm run build
npm start
```

#### Python Applications

```bash
# Flight Planner
cd apps/flightplanner
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000

# Flight School
cd apps/flightschool
make demo

# ForeFlight Dashboard
cd apps/foreflight-dashboard
make start
```

#### Clojure Applications

```bash
# Aviation Missions App
cd apps/aviation-missions-app
make build
make start
```

## Applications

### Aviation Missions App
A modern, full-stack web application for managing general aviation training missions. Built with Clojure backend and JavaScript frontend, featuring a comprehensive mission catalog, community interactions, and administrative tools.

**Technologies**: Clojure, Ring, Compojure, H2 Database, JavaScript  
**Location**: `apps/aviation-missions-app/`  
[View Documentation](apps/aviation-missions-app/README.md)

### Flight Planner
Unified VFR flight planning app with route + local planning, terrain checks, and weather. Features real-time weather data, terrain profile analysis, and interactive map-based route planning.

**Technologies**: Python, FastAPI, React, TypeScript, Leaflet  
**Location**: `apps/flightplanner/`  
[View Documentation](apps/flightplanner/README.md)

### Flight School
A Flask-based web application for managing a flight school's operations, including student registration, aircraft and instructor management, booking system, and administrative functions.

**Technologies**: Python, Flask, SQLite, Bootstrap  
**Location**: `apps/flightschool/`  
[View Documentation](apps/flightschool/README.md)

### ForeFlight Dashboard
ForeFlight logbook analysis web app with beads pattern for parallel processing.

**Technologies**: Python, FastAPI, React, TypeScript  
**Location**: `apps/foreflight-dashboard/`  
[View Documentation](apps/foreflight-dashboard/README.md)

### Flight Tracker
Real-time flight tracking service (coming soon).

**Technologies**: Node.js, TypeScript  
**Location**: `apps/flight-tracker/`

### Weather Briefing
Aviation weather briefing with AI analysis (coming soon).

**Technologies**: Node.js, TypeScript  
**Location**: `apps/weather-briefing/`

## Packages

### @aviation/shared-sdk

Core SDK providing:
- `BackgroundService`: Base class for background services
- `AIService`: Base class for AI-powered services
- `AIProvider`: Interface for AI provider implementations
- `SecureKeyStore`: Encrypted key/secret storage

### @aviation/keystore

Secure key management system for storing and retrieving API keys across services.

### @aviation/ui-framework

UI framework supporting multiple modalities:
- `MultiTabWebUI`: Container for multi-tab web interfaces
- `MobileUI`: Base class for mobile applications
- `StandaloneWebUI`: Base class for standalone web applications

## Security

### Key Store

API keys and secrets are stored in an encrypted keystore (`.keystore` file) using AES-256-CBC encryption.

**Important**: In production, set the `KEYSTORE_ENCRYPTION_KEY` environment variable to a secure value.

```bash
export KEYSTORE_ENCRYPTION_KEY="your-secure-key-here"
```

### Setting API Keys

```typescript
import { SecureKeyStore } from '@aviation/keystore';

const keystore = new SecureKeyStore();
keystore.setSecret('service-name', 'api-key-name', 'your-api-key');
```

## Creating New Applications

1. Create a new directory under `apps/`:
```bash
mkdir -p apps/my-aviation-app/src
```

2. Create `package.json` with dependencies on shared packages:
```json
{
  "name": "@aviation/my-aviation-app",
  "dependencies": {
    "@aviation/shared-sdk": "workspace:*",
    "@aviation/keystore": "workspace:*"
  }
}
```

3. Extend `BackgroundService` in your application:
```typescript
import { BackgroundService, ServiceConfig } from '@aviation/shared-sdk';
import { SecureKeyStore } from '@aviation/keystore';

export class MyService extends BackgroundService {
  protected async onStart(): Promise<void> {
    // Initialization logic
  }

  protected async onStop(): Promise<void> {
    // Cleanup logic
  }
}
```

## License

MIT
