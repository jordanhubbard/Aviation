# @aviation/keystore

Secure, encrypted key storage for aviation applications.

## Overview

The Aviation Keystore provides a secure way to store and retrieve sensitive configuration like API keys, passwords, and tokens. All secrets are encrypted using AES-256-CBC encryption and organized by service name.

## Installation

```bash
npm install @aviation/keystore
```

## Quick Start

### Basic Usage

```typescript
import { createSecretLoader } from '@aviation/keystore';

// Create a loader for your service
const secrets = createSecretLoader('my-service');

// Get a secret
const apiKey = secrets.get('API_KEY');

// Get a required secret (throws if not found)
const secretKey = secrets.getRequired('SECRET_KEY');

// Get with default value
const port = secrets.getWithDefault('PORT', '3000');
```

### Advanced Usage

```typescript
import { SecureKeyStore } from '@aviation/keystore';

// Create a keystore instance
const keystore = new SecureKeyStore({
  storePath: '/path/to/.keystore',
  encryptionKey: process.env.KEYSTORE_ENCRYPTION_KEY,
});

// Set a secret
keystore.setSecret('my-service', 'API_KEY', 'secret-value');

// Get a secret
const value = keystore.getSecret('my-service', 'API_KEY');

// List all keys for a service
const keys = keystore.listKeys('my-service');

// Delete a secret
keystore.deleteSecret('my-service', 'OLD_KEY');
```

## API Reference

### SecretLoader

High-level interface for loading secrets with environment variable fallback.

#### `createSecretLoader(serviceName, config?)`

Creates a new secret loader instance.

**Parameters:**
- `serviceName` (string): Name of your service
- `config` (LoaderConfig, optional): Configuration options
  - `keystorePath` (string): Path to keystore file
  - `fallbackToEnv` (boolean): Enable environment variable fallback (default: true)

**Returns:** SecretLoader instance

#### `loader.get(key)`

Get a secret value.

**Parameters:**
- `key` (string): Secret key name

**Returns:** string | undefined

#### `loader.getRequired(key)`

Get a required secret value. Throws an error if not found.

**Parameters:**
- `key` (string): Secret key name

**Returns:** string

**Throws:** Error if secret not found

#### `loader.getWithDefault(key, defaultValue)`

Get a secret with a fallback default value.

**Parameters:**
- `key` (string): Secret key name
- `defaultValue` (string): Default value if secret not found

**Returns:** string

#### `loader.has(key)`

Check if a secret exists.

**Parameters:**
- `key` (string): Secret key name

**Returns:** boolean

#### `loader.listKeys()`

List all keys for this service.

**Returns:** string[]

### SecureKeyStore

Low-level interface for direct keystore management.

#### `new SecureKeyStore(config?)`

Creates a new keystore instance.

**Parameters:**
- `config` (SecureKeyStoreConfig, optional):
  - `storePath` (string): Path to keystore file (default: `.keystore`)
  - `encryptionKey` (string): Encryption key (default: from `KEYSTORE_ENCRYPTION_KEY` env var)

#### `keystore.setSecret(service, key, value)`

Store a secret.

**Parameters:**
- `service` (string): Service name
- `key` (string): Secret key
- `value` (string): Secret value

#### `keystore.getSecret(service, key)`

Retrieve a secret.

**Parameters:**
- `service` (string): Service name
- `key` (string): Secret key

**Returns:** string | undefined

#### `keystore.deleteSecret(service, key)`

Delete a secret.

**Parameters:**
- `service` (string): Service name
- `key` (string): Secret key

**Returns:** boolean (true if deleted, false if not found)

#### `keystore.listKeys(service)`

List all keys for a service.

**Parameters:**
- `service` (string): Service name

**Returns:** string[]

## Security

### Encryption

- **Algorithm**: AES-256-CBC
- **Key Derivation**: scrypt with SHA-256 salt
- **IV**: Random 16-byte initialization vector per encryption

### Best Practices

1. **Never commit** `.keystore` to version control (already in `.gitignore`)
2. **Set encryption key** via `KEYSTORE_ENCRYPTION_KEY` environment variable in production
3. **Restrict file permissions**: `chmod 600 .keystore`
4. **Use separate keystores** for development and production
5. **Rotate secrets regularly**

### Encryption Key

Generate a secure encryption key:

```bash
openssl rand -base64 32
```

Set it in your environment:

```bash
export KEYSTORE_ENCRYPTION_KEY="your-generated-key"
```

## Migration

See the [Secrets Management Documentation](../../docs/SECRETS_MANAGEMENT.md) for complete migration instructions.

Quick migration from `.env` files:

```bash
# From monorepo root
npm run secrets:migrate
```

## CLI Tools

The keystore comes with CLI tools for management:

```bash
# List all services
npm run keystore services

# List secrets for a service
npm run keystore list my-service

# Get a secret
npm run keystore get my-service API_KEY

# Set a secret
npm run keystore set my-service API_KEY "value"

# Delete a secret
npm run keystore delete my-service OLD_KEY
```

## TypeScript Support

This package includes full TypeScript type definitions.

```typescript
import type { 
  SecureKeyStore, 
  SecureKeyStoreConfig,
  SecretEntry,
  SecretLoader,
  LoaderConfig 
} from '@aviation/keystore';
```

## Examples

### Express Application

```typescript
import express from 'express';
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('my-app');
const app = express();

const port = secrets.getWithDefault('PORT', '3000');
const jwtSecret = secrets.getRequired('JWT_SECRET');

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

### Database Connection

```typescript
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('my-app');

const dbConfig = {
  host: secrets.getRequired('DB_HOST'),
  port: parseInt(secrets.getWithDefault('DB_PORT', '5432')),
  username: secrets.getRequired('DB_USERNAME'),
  password: secrets.getRequired('DB_PASSWORD'),
  database: secrets.getRequired('DB_NAME'),
};
```

### API Client

```typescript
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('weather-service');

class WeatherAPI {
  private apiKey: string;
  
  constructor() {
    this.apiKey = secrets.getRequired('WEATHER_API_KEY');
  }
  
  async getForecast(location: string) {
    const response = await fetch(
      `https://api.weather.com/forecast?location=${location}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      }
    );
    return response.json();
  }
}
```

## Development

```bash
# Build the package
npm run build

# Watch mode
npm run dev

# Clean build artifacts
npm run clean
```

## License

MIT

## See Also

- [Secrets Management Guide](../../docs/SECRETS_MANAGEMENT.md)
- [Security Guidelines](../../docs/SECURITY.md)
- [Monorepo Documentation](../../README.md)

