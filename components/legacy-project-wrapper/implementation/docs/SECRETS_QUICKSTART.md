# Secrets Management - Quick Reference

**TL;DR**: The Aviation monorepo now has a secure keystore for managing secrets. Migrate your `.env` files and start using encrypted storage for API keys.

## 30-Second Quick Start

```bash
# 1. Migrate existing secrets
npm run secrets:migrate

# 2. View what was migrated
npm run keystore:list

# 3. Use in your code
# (see examples below)
```

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run secrets:migrate` | Import secrets from all `.env` files |
| `npm run keystore:list` | List all services with secrets |
| `npm run keystore list <service>` | List secrets for a service |
| `npm run keystore get <service> <key>` | Get a secret value |
| `npm run keystore set <service> <key> <value>` | Set a secret |
| `npm run keystore delete <service> <key>` | Delete a secret |

## Code Examples

### TypeScript/Node.js

```typescript
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('my-service-name');

// Get (returns undefined if not found)
const apiKey = secrets.get('API_KEY');

// Get required (throws if not found)
const secret = secrets.getRequired('SECRET_KEY');

// Get with default
const port = secrets.getWithDefault('PORT', '3000');
```

### Express Configuration

```typescript
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('my-api');

const config = {
  port: secrets.getWithDefault('PORT', '3000'),
  jwtSecret: secrets.getRequired('JWT_SECRET'),
  dbUrl: secrets.getRequired('DATABASE_URL'),
};
```

## Service Names

| Application | Service Name |
|-------------|-------------|
| Aviation Missions | `aviation-missions` |
| ForeFlight Dashboard | `foreflight-dashboard` |
| Flight Planner | `flight-planner` |
| Flight School | `flightschool` |
| Flight Tracker | `flight-tracker` |
| Weather Briefing | `weather-briefing` |

## Where to Put Secrets

### Development
```bash
# Add directly via CLI
npm run keystore set my-service API_KEY "dev-key-123"
```

### Production
```bash
# Set encryption key first!
export KEYSTORE_ENCRYPTION_KEY=$(openssl rand -base64 32)

# Then add secrets
npm run keystore set my-service API_KEY "prod-key-xyz"
```

### Docker
```yaml
# Mount keystore (dev only!)
volumes:
  - ./.keystore:/app/.keystore:ro

# Or use environment variables (production)
environment:
  - API_KEY=${API_KEY}
  - SECRET_KEY=${SECRET_KEY}
```

## Security Checklist

- [x] `.keystore` is in `.gitignore` ✅
- [x] Keystore file has 600 permissions ✅
- [ ] Set `KEYSTORE_ENCRYPTION_KEY` in production
- [ ] Generated secure encryption key: `openssl rand -base64 32`
- [ ] Removed old `.env` files (optional, after migration)

## Troubleshooting

**"Secret not found"**
```bash
# Check if it exists
npm run keystore list my-service

# Add it
npm run keystore set my-service MY_KEY "my-value"
```

**"Failed to decrypt"**
- Encryption key changed
- Re-run migration or manually re-add secrets

**Need more help?**
- Full docs: [docs/SECRETS_MANAGEMENT.md](docs/SECRETS_MANAGEMENT.md)
- Examples: [examples/keystore-integration.ts](examples/keystore-integration.ts)
- Package docs: [packages/keystore/README.md](packages/keystore/README.md)

## Migration Path

1. **Before**: Secrets in `.env` files (not tracked in git)
   ```bash
   # .env
   API_KEY=secret123
   SECRET_KEY=verysecret
   ```

2. **Migration**: Run migration tool
   ```bash
   npm run secrets:migrate
   ```

3. **After**: Secrets in encrypted keystore
   ```typescript
   // Your code
   const secrets = createSecretLoader('my-service');
   const apiKey = secrets.get('API_KEY');
   ```

4. **Cleanup**: Remove `.env` after verification (optional)

## What Got Created

| File/Directory | Purpose |
|---------------|---------|
| `packages/keystore/` | Keystore package |
| `scripts/migrate-secrets.ts` | Migration tool |
| `scripts/keystore-cli.ts` | CLI interface |
| `.keystore` | Encrypted secrets file |
| `docs/SECRETS_MANAGEMENT.md` | Full documentation |
| `examples/keystore-integration.ts` | Code examples |

## Features

✅ AES-256-CBC encryption  
✅ Service-based organization  
✅ CLI management tools  
✅ TypeScript support  
✅ Environment variable fallback  
✅ Automatic migration from .env  
✅ Secure file permissions  
✅ Git-ignored by default  

---

**Ready to start?** Run `npm run secrets:migrate` now!

