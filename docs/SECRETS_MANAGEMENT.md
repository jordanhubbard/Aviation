# Secrets Management

This document describes how to manage secrets and API keys in the Aviation monorepo using the secure keystore system.

## Overview

The Aviation monorepo uses a secure, encrypted keystore for managing sensitive configuration like API keys, passwords, and tokens. This replaces the traditional `.env` file approach with a more secure, centralized solution.

### Benefits

- **Encrypted Storage**: All secrets are encrypted using AES-256-CBC encryption
- **Centralized Management**: One keystore for all applications in the monorepo
- **Service Organization**: Secrets are organized by service name
- **CLI Tools**: Easy-to-use command-line tools for managing secrets
- **Migration Support**: Automatic migration from existing `.env` files
- **Backward Compatible**: Falls back to environment variables during transition

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Migrate Existing Secrets

If you have existing `.env` files in your applications:

```bash
npm run secrets:migrate
```

This will:
- Scan all applications for `.env` files
- Identify sensitive configuration (API keys, passwords, tokens, etc.)
- Import them into the encrypted keystore
- Generate a summary of what was migrated

### 3. Verify Migration

List all services with secrets:

```bash
npm run keystore:list
```

List secrets for a specific service:

```bash
npm run keystore list foreflight-dashboard
```

### 4. Update Your Application

See the [Usage in Applications](#usage-in-applications) section below.

## Keystore CLI

The keystore provides a command-line interface for managing secrets.

### Available Commands

```bash
# List all services
npm run keystore services

# List secrets for a service
npm run keystore list <service-name>

# Get a specific secret
npm run keystore get <service-name> <key>

# Set a secret
npm run keystore set <service-name> <key> <value>

# Delete a secret
npm run keystore delete <service-name> <key>
```

### Examples

```bash
# List all services
npm run keystore services

# List secrets for ForeFlight Dashboard
npm run keystore list foreflight-dashboard

# Get the SECRET_KEY
npm run keystore get foreflight-dashboard SECRET_KEY

# Set a new API key
npm run keystore set foreflight-dashboard WEATHER_API_KEY "abc123xyz"

# Delete an old key
npm run keystore delete foreflight-dashboard OLD_API_KEY
```

## Usage in Applications

### TypeScript/Node.js Applications

For TypeScript and Node.js applications, use the `SecretLoader`:

```typescript
import { createSecretLoader } from '@aviation/keystore';

// Create a loader for your service
const secrets = createSecretLoader('my-service-name');

// Get a secret (returns undefined if not found)
const apiKey = secrets.get('API_KEY');

// Get a required secret (throws if not found)
const secretKey = secrets.getRequired('SECRET_KEY');

// Get a secret with a default value
const port = secrets.getWithDefault('PORT', '3000');

// Check if a secret exists
if (secrets.has('OPTIONAL_KEY')) {
  // Do something
}
```

#### Service Names

Use these service names for the loader:

- `aviation-missions` - Aviation Missions App
- `foreflight-dashboard` - ForeFlight Dashboard
- `flight-planner` - Flight Planner
- `flightschool` - Flight School
- `flight-tracker` - Flight Tracker
- `weather-briefing` - Weather Briefing

#### Example: Express Application

```typescript
import express from 'express';
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('my-app');

const app = express();

// Use secrets in your application
const port = secrets.getWithDefault('PORT', '3000');
const apiKey = secrets.getRequired('API_KEY');

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

### Python Applications

For Python applications, you can access the keystore using a subprocess or by implementing a Python wrapper. Here's a simple approach:

```python
import subprocess
import json
import os

class SecretLoader:
    def __init__(self, service_name):
        self.service_name = service_name
        self.keystore_cli = os.path.join(
            os.path.dirname(__file__), 
            '../../scripts/keystore-cli.ts'
        )
    
    def get(self, key):
        """Get a secret value"""
        try:
            result = subprocess.run(
                ['npx', 'ts-node', self.keystore_cli, 'get', self.service_name, key],
                capture_output=True,
                text=True,
                check=True
            )
            # Parse the output to extract the value
            lines = result.stdout.strip().split('\n')
            if len(lines) >= 2:
                return lines[-1].strip()
        except subprocess.CalledProcessError:
            # Fall back to environment variables
            return os.environ.get(key)
        return None
    
    def get_required(self, key):
        """Get a required secret value"""
        value = self.get(key)
        if value is None:
            raise ValueError(f"Required secret not found: {self.service_name}:{key}")
        return value
    
    def get_with_default(self, key, default):
        """Get a secret with a default value"""
        return self.get(key) or default

# Usage
secrets = SecretLoader('my-service')
api_key = secrets.get_required('API_KEY')
port = secrets.get_with_default('PORT', '5000')
```

### Docker Environments

For Docker deployments, you have several options:

#### Option 1: Mount the Keystore (Development)

```yaml
# docker-compose.yml
services:
  app:
    image: my-app
    volumes:
      - ./.keystore:/app/.keystore:ro
    environment:
      - KEYSTORE_ENCRYPTION_KEY=${KEYSTORE_ENCRYPTION_KEY}
```

#### Option 2: Environment Variables (Production)

For production, continue using environment variables. The `SecretLoader` will fall back to `process.env` automatically:

```yaml
# docker-compose.prod.yml
services:
  app:
    image: my-app
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - API_KEY=${API_KEY}
```

#### Option 3: Secrets Management System

For production deployments on platforms like Railway, Fly.io, or Kubernetes, use their native secrets management and set environment variables. The loader will use them automatically.

## Migration Guide

### Step 1: Run Migration

```bash
npm run secrets:migrate
```

### Step 2: Update Application Code

Replace direct `process.env` access:

```typescript
// Before
const apiKey = process.env.API_KEY;
const secret = process.env.SECRET_KEY;

// After
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('my-service');
const apiKey = secrets.get('API_KEY');
const secret = secrets.getRequired('SECRET_KEY');
```

### Step 3: Test Your Application

Run your application and verify it can access secrets:

```bash
cd apps/my-app
npm run dev
```

### Step 4: Update Dependencies

Add the keystore package to your application's `package.json`:

```json
{
  "dependencies": {
    "@aviation/keystore": "*"
  }
}
```

### Step 5: Remove .env Files (Optional)

After confirming everything works, you can optionally remove `.env` files:

```bash
# IMPORTANT: Only do this after verifying migration!
rm apps/*/\.env
```

Note: Keep `.env.example` files for documentation purposes.

## Security Best Practices

### Encryption Key

The keystore uses an encryption key for securing secrets. By default, it uses a combination of:
1. `KEYSTORE_ENCRYPTION_KEY` environment variable (if set)
2. A default key (for development only)

**For production**, always set `KEYSTORE_ENCRYPTION_KEY`:

```bash
# Generate a secure key
openssl rand -base64 32

# Set it in your environment
export KEYSTORE_ENCRYPTION_KEY="your-generated-key"
```

### .gitignore

The `.keystore` file is already in `.gitignore`. **Never commit it to version control.**

### Access Control

- Keep `.keystore` permissions restricted: `chmod 600 .keystore`
- Don't share the keystore file or encryption key via insecure channels
- Use separate keystores for development and production

### Rotation

Rotate secrets regularly:

```bash
# Update a secret
npm run keystore set my-service API_KEY "new-key-value"

# Restart your application to use the new value
```

## Troubleshooting

### "Secret not found" Error

1. Check if the secret exists:
   ```bash
   npm run keystore list my-service
   ```

2. If not found, add it:
   ```bash
   npm run keystore set my-service MY_KEY "my-value"
   ```

3. Or fall back to environment variables temporarily:
   ```bash
   export MY_KEY="my-value"
   ```

### "Failed to decrypt" Error

This usually means the encryption key changed. Solutions:

1. Re-run migration with the correct encryption key
2. Or manually re-add secrets using the CLI

### Keystore Not Found

Make sure you're running commands from the monorepo root, or provide the correct keystore path in your loader configuration:

```typescript
const secrets = createSecretLoader('my-service', {
  keystorePath: '/absolute/path/to/.keystore'
});
```

## Architecture

### File Structure

```
Aviation/
├── .keystore                    # Encrypted secrets (not in git)
├── packages/
│   └── keystore/
│       └── src/
│           ├── keystore.ts      # Core keystore implementation
│           ├── loader.ts        # Application loader utility
│           └── index.ts         # Public API
└── scripts/
    ├── migrate-secrets.ts       # Migration tool
    └── keystore-cli.ts          # CLI interface
```

### Data Format

Secrets are stored in an encrypted file with this structure:

```json
{
  "service:key": {
    "service": "service-name",
    "key": "KEY_NAME",
    "value": "encrypted-value",
    "createdAt": "2026-01-05T...",
    "updatedAt": "2026-01-05T..."
  }
}
```

The entire JSON structure is encrypted before being written to `.keystore`.

### Encryption

- **Algorithm**: AES-256-CBC
- **Key Derivation**: scrypt with SHA-256 salt
- **IV**: Random 16-byte initialization vector per encryption

## Future Enhancements

Planned improvements to the secrets management system:

- [ ] Python native implementation (no subprocess calls)
- [ ] Vault/AWS Secrets Manager integration
- [ ] Automatic secret rotation
- [ ] Audit logging for secret access
- [ ] Web UI for secret management
- [ ] Multi-environment support (dev/staging/prod)

## Support

For questions or issues with secrets management:

1. Check this documentation
2. Review the [Security Guidelines](SECURITY.md)
3. Open an issue on GitHub
4. Contact the platform team

## See Also

- [SECURITY.md](SECURITY.md) - General security guidelines
- [AGENTS.md](../AGENTS.md) - Repository structure and conventions
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guidelines

