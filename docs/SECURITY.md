# Security Guide

## Overview

Security is a critical aspect of the Aviation monorepo, particularly for managing API keys and secrets used by background services.

## Secure Key Store

### Encryption

The `SecureKeyStore` uses AES-256-CBC encryption to protect API keys and secrets:

- **Algorithm**: AES-256-CBC
- **Key Derivation**: scrypt (salt-based)
- **IV**: Random 16-byte initialization vector per encryption
- **File Permissions**: 0600 (read/write for owner only)

### Configuration

#### Environment Variables

**Production Setup** (Required):

```bash
export KEYSTORE_ENCRYPTION_KEY="your-strong-encryption-key-here"
```

⚠️ **Warning**: The default encryption key is for development only. Always set a strong encryption key in production.

#### Custom Storage Path

```typescript
const keystore = new SecureKeyStore({
  storePath: '/secure/path/to/.keystore',
  encryptionKey: process.env.KEYSTORE_ENCRYPTION_KEY
});
```

### Usage

#### Storing Secrets

```typescript
import { SecureKeyStore } from '@aviation/keystore';

const keystore = new SecureKeyStore();

// Store an API key
keystore.setSecret('flight-tracker', 'flightapi_key', 'abc123xyz');

// Store multiple keys for a service
keystore.setSecret('weather-briefing', 'weather_api_key', 'weather123');
keystore.setSecret('weather-briefing', 'ai_api_key', 'ai456');
```

#### Retrieving Secrets

```typescript
// Get a specific secret
const apiKey = keystore.getSecret('flight-tracker', 'flightapi_key');

if (!apiKey) {
  console.error('API key not found');
  // Handle missing key appropriately
}
```

#### Managing Secrets

```typescript
// List all keys for a service
const keys = keystore.listKeys('weather-briefing');
console.log('Available keys:', keys);

// Delete a secret
const deleted = keystore.deleteSecret('flight-tracker', 'old_api_key');
console.log('Deleted:', deleted);
```

## Best Practices

### 1. Key Management

- ✅ **DO** use environment variables for the encryption key
- ✅ **DO** rotate API keys regularly
- ✅ **DO** use different API keys for development and production
- ❌ **DON'T** commit the `.keystore` file to version control (it's in `.gitignore`)
- ❌ **DON'T** hardcode API keys in source code
- ❌ **DON'T** share the encryption key

### 2. Encryption Key

Generate a strong encryption key:

```bash
# Using openssl
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. File Permissions

The keystore file is automatically created with restricted permissions (0600), but verify:

```bash
ls -la .keystore
# Should show: -rw------- (owner read/write only)
```

### 4. Backup and Recovery

- Store the encryption key securely (e.g., in a password manager or HSM)
- Back up the `.keystore` file separately from the encryption key
- Without the encryption key, the keystore cannot be decrypted

### 5. Service-Specific Keys

Always namespace keys by service:

```typescript
// Good: Service-specific namespacing
keystore.setSecret('flight-tracker', 'api_key', 'key1');
keystore.setSecret('weather-briefing', 'api_key', 'key2');

// Each service has its own 'api_key' without conflict
```

## Production Deployment

### Environment Setup

```bash
# Set encryption key
export KEYSTORE_ENCRYPTION_KEY="$(openssl rand -base64 32)"

# Verify it's set
echo $KEYSTORE_ENCRYPTION_KEY
```

### Initial Key Provisioning

Create a setup script for initial key provisioning:

```typescript
// setup-keys.ts
import { SecureKeyStore } from '@aviation/keystore';

const keystore = new SecureKeyStore();

// Prompt for API keys (or read from secure source)
const flightApiKey = process.env.FLIGHT_API_KEY;
const weatherApiKey = process.env.WEATHER_API_KEY;

if (flightApiKey) {
  keystore.setSecret('flight-tracker', 'flightapi_key', flightApiKey);
}

if (weatherApiKey) {
  keystore.setSecret('weather-briefing', 'weather_api_key', weatherApiKey);
}

console.log('Keys provisioned successfully');
```

Run once during deployment:

```bash
FLIGHT_API_KEY="xxx" WEATHER_API_KEY="yyy" node dist/setup-keys.js
```

## Advanced Security

### Hardware Security Module (HSM)

For enhanced security, consider using an HSM or cloud key management service:

```typescript
// Example: AWS KMS integration (pseudo-code)
class HSMKeyStore extends SecureKeyStore {
  private kms: AWS.KMS;
  
  constructor() {
    super({
      encryptionKey: 'hsm-managed-key-id'
    });
    this.kms = new AWS.KMS();
  }
  
  // Override encryption to use KMS
  protected encrypt(text: string): Promise<string> {
    return this.kms.encrypt({
      KeyId: this.encryptionKey,
      Plaintext: text
    }).promise();
  }
}
```

### Audit Logging

Add audit logging for key access:

```typescript
class AuditedKeyStore extends SecureKeyStore {
  getSecret(service: string, key: string): string | undefined {
    const value = super.getSecret(service, key);
    console.log(`[AUDIT] Key accessed: ${service}:${key} at ${new Date().toISOString()}`);
    return value;
  }
}
```

### Key Rotation

Implement automatic key rotation:

```typescript
function rotateKeys() {
  const keystore = new SecureKeyStore();
  
  // Get current keys
  const oldKey = keystore.getSecret('service', 'api_key');
  
  // Fetch new key from provider
  const newKey = fetchNewKeyFromProvider();
  
  // Update keystore
  keystore.setSecret('service', 'api_key', newKey);
  
  // Revoke old key with provider
  revokeOldKeyWithProvider(oldKey);
}
```

## Security Checklist

Before deploying to production:

- [ ] Set `KEYSTORE_ENCRYPTION_KEY` environment variable
- [ ] Verify `.keystore` is in `.gitignore`
- [ ] Provision all required API keys
- [ ] Test key retrieval works correctly
- [ ] Verify file permissions on `.keystore` (0600)
- [ ] Document key rotation procedures
- [ ] Set up monitoring for key access failures
- [ ] Create backup of encryption key (stored separately)
- [ ] Review all services' key requirements
- [ ] Remove any hardcoded keys from source code

## Troubleshooting

### "Failed to load secrets" error

- Check file permissions on `.keystore`
- Verify `KEYSTORE_ENCRYPTION_KEY` is set correctly
- Ensure the keystore file isn't corrupted

### "API key not found" warning

- Verify keys are provisioned: `keystore.listKeys('service-name')`
- Check service name matches exactly (case-sensitive)
- Re-run key provisioning script

### Corrupted keystore

If the keystore becomes corrupted:

1. Remove the old keystore: `rm .keystore`
2. Re-provision all API keys
3. Restart services

## Contact

For security issues, please report them through appropriate channels rather than public issue trackers.
