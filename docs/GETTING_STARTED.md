# Getting Started Guide

Welcome to the Aviation monorepo! This guide will help you get up and running quickly.

## Quick Start

### Prerequisites

- Node.js 20 or higher
- npm 9 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/jordanhubbard/Aviation.git
cd Aviation

# Install dependencies
npm install

# Build all packages
npm run build
```

### Running Your First Application

Let's start the Flight Tracker application:

```bash
# Navigate to the flight-tracker app
cd apps/flight-tracker

# Run the application
npm start
```

You should see output like:

```
Starting Flight Tracker Application...
Starting service: flight-tracker
No API key found for flight-tracker. Some features may be limited.
Flight Tracker Service is now monitoring flights...
Service flight-tracker started successfully
Flight Tracker is running. Press Ctrl+C to stop.
```

Press `Ctrl+C` to stop the application.

## Setting Up API Keys

Applications use the secure keystore to manage API keys. Here's how to set them up:

### Using Environment Variables

```bash
# Set the encryption key (important for production!)
export KEYSTORE_ENCRYPTION_KEY="your-secure-key-here"

# Set API keys for your services
export FLIGHT_API_KEY="your-flight-api-key"
export WEATHER_API_KEY="your-weather-api-key"
```

### Programmatic Setup

Create a setup script to provision keys:

```typescript
import { SecureKeyStore } from '@aviation/keystore';

const keystore = new SecureKeyStore();

// Store API keys
keystore.setSecret('flight-tracker', 'flightapi_key', process.env.FLIGHT_API_KEY);
keystore.setSecret('weather-briefing', 'weather_api_key', process.env.WEATHER_API_KEY);
keystore.setSecret('weather-briefing', 'ai_api_key', process.env.AI_API_KEY);

console.log('API keys configured successfully!');
```

## Development Workflow

### Build Everything

```bash
npm run build
```

### Watch Mode (for development)

```bash
# In the root directory
npm run dev
```

This will watch all packages for changes and rebuild automatically.

### Clean Build Artifacts

```bash
npm run clean
```

### Running Tests

```bash
npm test
```

## Project Structure

```
Aviation/
├── apps/                      # Applications
│   ├── flight-tracker/       # Flight tracking service
│   └── weather-briefing/     # Weather briefing service
├── packages/                  # Shared packages
│   ├── shared-sdk/           # Common SDK
│   ├── keystore/             # Secure key store
│   └── ui-framework/         # UI framework
└── docs/                      # Documentation
    ├── ARCHITECTURE.md        # Architecture details
    ├── SECURITY.md           # Security guide
    └── UI_MODALITIES.md      # UI deployment options
```

## Creating a New Application

1. Create the directory structure:

```bash
mkdir -p apps/my-app/src
cd apps/my-app
```

2. Create `package.json`:

```json
{
  "name": "@aviation/my-app",
  "version": "0.1.0",
  "description": "My aviation application",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@aviation/shared-sdk": "*",
    "@aviation/keystore": "*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

3. Create `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"],
  "references": [
    { "path": "../../packages/shared-sdk" },
    { "path": "../../packages/keystore" }
  ]
}
```

4. Create your service in `src/service.ts`:

```typescript
import { BackgroundService, ServiceConfig } from '@aviation/shared-sdk';
import { SecureKeyStore } from '@aviation/keystore';

export class MyService extends BackgroundService {
  private keystore: SecureKeyStore;

  constructor(config: ServiceConfig, keystore: SecureKeyStore) {
    super(config);
    this.keystore = keystore;
  }

  protected async onStart(): Promise<void> {
    console.log('My service is starting...');
    // Your initialization logic
  }

  protected async onStop(): Promise<void> {
    console.log('My service is stopping...');
    // Your cleanup logic
  }
}
```

5. Create the entry point in `src/index.ts`:

```typescript
import { MyService } from './service';
import { SecureKeyStore } from '@aviation/keystore';

async function main() {
  const keystore = new SecureKeyStore();
  const service = new MyService(
    { name: 'my-app', enabled: true, autoStart: true },
    keystore
  );

  await service.start();

  process.on('SIGINT', async () => {
    await service.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

6. Build and run:

```bash
cd ../..  # Back to root
npm install
npm run build
cd apps/my-app
npm start
```

## Common Tasks

### Adding Dependencies

```bash
# In the specific package/app directory
npm install <package-name>

# Or from root for all workspaces
npm install <package-name> --workspace=@aviation/my-app
```

### Viewing Logs

Applications log to console by default. For production, consider:

- Using a logging library (e.g., Winston, Pino)
- Redirecting output to files
- Using a log aggregation service

### Debugging

Use Node.js debugging tools:

```bash
# Run with inspector
node --inspect dist/index.js

# Or use VS Code debugger with launch.json configuration
```

## Next Steps

1. Read the [Architecture Guide](docs/ARCHITECTURE.md) to understand the system design
2. Review [Security Best Practices](docs/SECURITY.md) before deploying
3. Explore [UI Modalities](docs/UI_MODALITIES.md) for different deployment options
4. Check out the example applications in `apps/` directory

## Getting Help

- Read the documentation in the `docs/` directory
- Check package README files in `packages/` directory
- Review example applications in `apps/` directory

## Tips

- Always set `KEYSTORE_ENCRYPTION_KEY` in production
- Use environment-specific configurations
- Keep services small and focused
- Share common code through packages
- Write tests for your services
- Use TypeScript for type safety

Happy coding! ✈️
