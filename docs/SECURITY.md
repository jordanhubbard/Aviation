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

Audit logging is crucial for compliance and security. The following events require audit logs:

- Access to sensitive data (e.g., API keys, secrets)
- Changes to configuration settings
- User authentication and authorization actions
- Data modifications (e.g., creation, update, deletion of records)

#### Retention and Access Controls

- Logs should be retained for a minimum of 1 year.
- Access to audit logs should be restricted to authorized personnel only.
- Logs should be encrypted at rest and in transit.

#### Log Export Needs

- Audit logs should be exportable in a standardized format (e.g., CSV, JSON).
- Exported logs should include timestamps, event types, and relevant metadata.

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

### Input Validation and API Hardening

- [ ] Validate all user inputs to prevent injection attacks
- [ ] Use parameterized queries and ORM features to prevent SQL injection
- [ ] Implement rate limiting on API endpoints to prevent abuse
- [ ] Use HTTPS for all API communications to encrypt data in transit
- [ ] Regularly update dependencies to patch known vulnerabilities

### WebSocket Security Considerations

- [ ] Use secure WebSockets (wss://) to encrypt WebSocket traffic
- [ ] Validate all incoming WebSocket messages to prevent XSS and other attacks
- [ ] Implement authentication and authorization for WebSocket connections
- [ ] Limit WebSocket connection duration and enforce timeouts

### CORS and Rate Limits

- [ ] Configure CORS policies to restrict access to trusted origins
- [ ] Implement rate limiting on all endpoints to prevent DDoS attacks
- [ ] Use middleware to enforce CORS and rate limit rules
- [ ] Log and monitor CORS and rate limit violations

### Additional Security Controls

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

### Security Controls Checklist for Simulator

- [ ] Validate all user inputs to prevent injection attacks
- [ ] Use parameterized queries and ORM features to prevent SQL injection
- [ ] Implement rate limiting on API endpoints to prevent abuse
- [ ] Use HTTPS for all API communications to encrypt data in transit
- [ ] Regularly update dependencies to patch known vulnerabilities
- [ ] Use secure WebSockets (wss://) to encrypt WebSocket traffic
- [ ] Validate all incoming WebSocket messages to prevent XSS and other attacks
- [ ] Implement authentication and authorization for WebSocket connections
- [ ] Limit WebSocket connection duration and enforce timeouts
- [ ] Configure CORS policies to restrict access to trusted origins
- [ ] Implement rate limiting on all endpoints to prevent DDoS attacks
- [ ] Use middleware to enforce CORS and rate limit rules
- [ ] Log and monitor CORS and rate limit violations

## Privacy and Data Retention Rules

### Personal Identifiable Information (PII) Handling

- **Data Collected**: Identify any PII data collected by the applications.
- **Data Processing**: Ensure PII is processed in compliance with relevant regulations (e.g., GDPR).
- **Data Storage**: PII should be stored securely and only for as long as necessary.

### Retention and Deletion Policies

- **Retention Period**: Define the retention period for all types of data based on business needs and legal requirements.
- **Deletion Process**: Implement a process for securely deleting data once the retention period has expired.

### Consent Requirements

- **User Consent**: Obtain explicit consent from users before collecting their personal data.
- **Consent Management**: Maintain records of user consent and provide mechanisms for users to withdraw consent if desired.

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
