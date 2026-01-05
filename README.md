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
├── packages/              # Shared packages
│   ├── shared-sdk/       # Common SDK with AI methodology and service base classes
│   ├── keystore/         # Secure key store for API keys
│   └── ui-framework/     # UI framework supporting multiple modalities
├── apps/                 # Aviation applications
│   ├── flight-tracker/   # Real-time flight tracking service
│   └── weather-briefing/ # Aviation weather briefing with AI analysis
└── package.json          # Monorepo root configuration
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
