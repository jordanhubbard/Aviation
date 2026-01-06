# Application Secrets Integration Summary

All applications in the Aviation monorepo have been updated to use the secure keystore for managing secrets. This document provides a complete reference for each application's integration.

## Integration Status

✅ **All applications integrated with keystore**

| Application | Status | Language | Integration Method |
|------------|--------|----------|-------------------|
| ForeFlight Dashboard | ✅ Complete | Python | Python keystore client |
| Flight Planner | ✅ Complete | Python | Python keystore client |
| Flight School | ✅ Complete | Python | Python keystore client |
| Aviation Missions | ✅ Complete | Clojure | CLI subprocess |
| Flight Tracker | ✅ Complete | TypeScript | SecretLoader |
| Weather Briefing | ✅ Complete | TypeScript | SecretLoader |

## Application-Specific Details

### 1. ForeFlight Dashboard (`foreflight-dashboard`)

**Service Name:** `foreflight-dashboard`

**Secrets Used:**
- `SECRET_KEY` - Flask secret key (required)
- `DATABASE_URL` - Database connection string
- `FOREFLIGHT_API_KEY` - ForeFlight API key
- `FOREFLIGHT_API_SECRET` - ForeFlight API secret
- `SMTP_SERVER` - Email server
- `SMTP_USERNAME` - Email username
- `SMTP_PASSWORD` - Email password
- `REDIS_URL` - Redis connection string
- `SENTRY_DSN` - Sentry error tracking DSN

**Integration:**
- Created `src/core/secrets.py` with Python keystore client
- Updated `src/core/config.py` to import from secrets module
- Automatic fallback to environment variables

**Example Usage:**
```python
from src.core.secrets import get_secret

api_key = get_secret('FOREFLIGHT_API_KEY', required=True)
db_url = get_secret('DATABASE_URL', default='sqlite:///logbook.db')
```

**Add Secrets:**
```bash
npm run keystore set foreflight-dashboard SECRET_KEY "your-secret-key"
npm run keystore set foreflight-dashboard DATABASE_URL "postgresql://..."
```

---

### 2. Flight Planner (`flightplanner`)

**Service Name:** `flightplanner`

**Secrets Used:**
- `OPENWEATHERMAP_API_KEY` / `OPENWEATHER_API_KEY` - OpenWeatherMap API key
- `OPENTOPOGRAPHY_API_KEY` - OpenTopography API key for terrain data
- `OPENAIP_API_KEY` - OpenAIP API key for airspace data

**Integration:**
- Created `backend/app/secrets.py` with Python keystore client
- Updated `backend/app/config.py` with field validators
- Pydantic Settings automatically loads from keystore

**Example Usage:**
```python
from backend.app.config import settings

weather_key = settings.openweather_api_key
terrain_key = settings.opentopography_api_key
```

**Add Secrets:**
```bash
npm run keystore set flightplanner OPENWEATHERMAP_API_KEY "your-key"
npm run keystore set flightplanner OPENTOPOGRAPHY_API_KEY "your-key"
npm run keystore set flightplanner OPENAIP_API_KEY "your-key"
```

---

### 3. Flight School (`flightschool`)

**Service Name:** `flightschool`

**Secrets Used:**
- `SECRET_KEY` - Flask secret key (required)
- `DATABASE_URL` - Database connection string
- `WTF_CSRF_SECRET_KEY` - CSRF protection key
- `MAIL_SERVER` - Email server
- `MAIL_PORT` - Email port
- `MAIL_USERNAME` - Email username
- `MAIL_PASSWORD` - Email password
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI

**Integration:**
- Created `secrets.py` with Python keystore client
- Updated `config.py` to use secret loader functions
- Flask Config class loads secrets on initialization

**Example Usage:**
```python
from secrets import get_secret_key, get_database_url

secret = get_secret_key()
db_url = get_database_url()
```

**Add Secrets:**
```bash
npm run keystore set flightschool SECRET_KEY "your-secret-key"
npm run keystore set flightschool DATABASE_URL "sqlite:///flightschool.db"
npm run keystore set flightschool GOOGLE_CLIENT_ID "your-client-id"
npm run keystore set flightschool GOOGLE_CLIENT_SECRET "your-client-secret"
```

---

### 4. Aviation Missions App (`aviation-missions`)

**Service Name:** `aviation-missions`

**Secrets Used:**
- `DATABASE_URL` - H2 database path (JDBC URL)

**Integration:**
- Updated `backend/src/aviation_missions/db.clj`
- Added `get-database-url` function that calls keystore CLI
- Falls back to environment variable if keystore unavailable

**Example Usage:**
```clojure
;; Automatic - db-spec uses keystore
(db/get-all-missions)
```

**Add Secrets:**
```bash
npm run keystore set aviation-missions DATABASE_URL "jdbc:h2:./data/aviation-missions"
```

---

### 5. Flight Tracker (`flight-tracker`)

**Service Name:** `flight-tracker`

**Secrets Used:**
- `FLIGHT_API_KEY` - Generic flight API key
- `FLIGHTAWARE_API_KEY` - FlightAware API key
- `AVIATIONSTACK_API_KEY` - AviationStack API key

**Integration:**
- Updated `src/service.ts` to use `createSecretLoader`
- Loads secrets on service start
- Provides helpful warnings if keys missing

**Example Usage:**
```typescript
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('flight-tracker');
const apiKey = secrets.get('FLIGHT_API_KEY');
```

**Add Secrets:**
```bash
npm run keystore set flight-tracker FLIGHT_API_KEY "your-key"
npm run keystore set flight-tracker FLIGHTAWARE_API_KEY "your-key"
```

---

### 6. Weather Briefing (`weather-briefing`)

**Service Name:** `weather-briefing`

**Secrets Used:**
- `WEATHER_API_KEY` - Weather API key
- `AVIATION_WEATHER_API_KEY` - Aviation-specific weather API
- `AI_API_KEY` - AI service API key
- `OPENAI_API_KEY` - OpenAI API key for AI analysis

**Integration:**
- Updated `src/service.ts` to use `createSecretLoader`
- Loads secrets on service start
- Checks for multiple API key options

**Example Usage:**
```typescript
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('weather-briefing');
const weatherKey = secrets.get('WEATHER_API_KEY');
const aiKey = secrets.get('OPENAI_API_KEY');
```

**Add Secrets:**
```bash
npm run keystore set weather-briefing WEATHER_API_KEY "your-key"
npm run keystore set weather-briefing OPENAI_API_KEY "your-key"
```

---

## Python Keystore Client

Location: `packages/keystore/python/keystore.py`

### Features
- Automatic monorepo root detection
- Subprocess calls to npm keystore CLI
- In-memory caching for performance
- Fallback to environment variables
- Clean Python API

### API Reference

```python
from keystore import create_secret_loader, get_secret

# Create a loader
secrets = create_secret_loader('service-name')

# Get secrets
value = secrets.get('KEY_NAME')                    # Returns None if not found
value = secrets.get_required('KEY_NAME')           # Raises exception if not found
value = secrets.get_with_default('KEY', 'default') # Returns default if not found
exists = secrets.has('KEY_NAME')                   # Check if exists
keys = secrets.list_keys()                         # List all keys

# Quick helper
value = get_secret('service-name', 'KEY_NAME', 'default')
```

---

## TypeScript Integration

All TypeScript apps use the `@aviation/keystore` package directly.

### API Reference

```typescript
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('service-name');

// Get secrets
const value = secrets.get('KEY_NAME');                    // Returns undefined if not found
const value = secrets.getRequired('KEY_NAME');            // Throws if not found
const value = secrets.getWithDefault('KEY', 'default');   // Returns default if not found
const exists = secrets.has('KEY_NAME');                   // Check if exists
const keys = secrets.listKeys();                          // List all keys
```

---

## Clojure Integration

The Aviation Missions App uses subprocess calls to the keystore CLI.

### Pattern Used

```clojure
(defn- get-secret
  "Get secret from keystore using CLI"
  [key]
  (try
    (let [result (clojure.java.shell/sh 
                   "npm" "run" "keystore" "get" 
                   "aviation-missions" key
                   :dir "../..")]
      (when (zero? (:exit result))
        (-> result :out clojure.string/split-lines last clojure.string/trim)))
    (catch Exception _e nil)))
```

---

## Migration Checklist

For each application:

- [x] **ForeFlight Dashboard**
  - [x] Created Python keystore client integration
  - [x] Updated config.py to use keystore
  - [x] Added fallback to environment variables
  - [x] Documented secrets needed

- [x] **Flight Planner**
  - [x] Created Python keystore client integration
  - [x] Updated config.py with Pydantic validators
  - [x] Integrated with Settings class
  - [x] Documented secrets needed

- [x] **Flight School**
  - [x] Created Python keystore client integration
  - [x] Updated config.py to use secret loaders
  - [x] Integrated with Flask Config
  - [x] Documented secrets needed

- [x] **Aviation Missions**
  - [x] Updated db.clj to call keystore CLI
  - [x] Added fallback to environment variables
  - [x] Documented secrets needed

- [x] **Flight Tracker**
  - [x] Updated to use createSecretLoader
  - [x] Added helpful warning messages
  - [x] Documented secrets needed

- [x] **Weather Briefing**
  - [x] Updated to use createSecretLoader
  - [x] Added helpful warning messages
  - [x] Documented secrets needed

---

## Testing Your Integration

### 1. Add Test Secrets

```bash
# ForeFlight Dashboard
npm run keystore set foreflight-dashboard SECRET_KEY "test-secret-123"

# Flight Planner
npm run keystore set flightplanner OPENWEATHER_API_KEY "test-key-123"

# Flight School
npm run keystore set flightschool SECRET_KEY "test-secret-123"

# Aviation Missions
npm run keystore set aviation-missions DATABASE_URL "jdbc:h2:./data/test"

# Flight Tracker
npm run keystore set flight-tracker FLIGHT_API_KEY "test-key-123"

# Weather Briefing
npm run keystore set weather-briefing WEATHER_API_KEY "test-key-123"
```

### 2. Verify Secrets

```bash
npm run keystore:list
npm run keystore list foreflight-dashboard
npm run keystore get foreflight-dashboard SECRET_KEY
```

### 3. Test Applications

Each application should now load secrets from the keystore automatically.

---

## Backward Compatibility

All integrations maintain backward compatibility with environment variables:

1. **Keystore First**: Tries to load from keystore
2. **Environment Fallback**: Falls back to `process.env` / `os.environ`
3. **Default Values**: Uses sensible defaults where appropriate

This allows for gradual migration and ensures applications work in environments where the keystore isn't available (e.g., Docker containers with env vars).

---

## Production Deployment

### Option 1: Use Keystore (Recommended for Development)

```bash
# Set encryption key
export KEYSTORE_ENCRYPTION_KEY=$(openssl rand -base64 32)

# Add production secrets
npm run keystore set my-service API_KEY "prod-key"

# Deploy with keystore
docker-compose up
```

### Option 2: Use Environment Variables (Recommended for Production)

```yaml
# docker-compose.prod.yml
services:
  app:
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - API_KEY=${API_KEY}
```

Applications will automatically fall back to environment variables.

---

## Troubleshooting

### Python Apps Can't Find Keystore

**Problem**: `Warning: Keystore not available`

**Solution**:
1. Ensure you're running from the monorepo root
2. Check that `npm` is in your PATH
3. Verify keystore package is built: `cd packages/keystore && npm run build`

### Clojure App Can't Access Secrets

**Problem**: Database connection fails

**Solution**:
1. Set `KEYSTORE_ROOT` environment variable to monorepo root
2. Or use environment variable: `export DATABASE_URL="jdbc:h2:./data/aviation-missions"`

### TypeScript Apps Can't Load Secrets

**Problem**: `Module not found: @aviation/keystore`

**Solution**:
1. Install dependencies: `npm install`
2. Build keystore: `cd packages/keystore && npm run build`
3. Check workspace configuration in root `package.json`

---

## Summary

✅ **All 6 applications integrated**  
✅ **Python keystore client created**  
✅ **TypeScript apps use SecretLoader**  
✅ **Clojure app uses CLI subprocess**  
✅ **Backward compatible with environment variables**  
✅ **Comprehensive documentation provided**  

Every application now knows how to look up secrets from the keystore!

