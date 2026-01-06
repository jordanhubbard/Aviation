/**
 * Keystore Integration Examples
 * 
 * This file demonstrates how to integrate the secure keystore
 * into your Aviation monorepo applications.
 */

import { createSecretLoader, SecureKeyStore } from '@aviation/keystore';

// ============================================================================
// Example 1: Basic Usage with SecretLoader (Recommended)
// ============================================================================

function basicLoaderExample() {
  console.log('Example 1: Basic SecretLoader Usage\n');
  
  // Create a loader for your service
  const secrets = createSecretLoader('foreflight-dashboard');
  
  // Get a secret (returns undefined if not found)
  const apiKey = secrets.get('API_KEY');
  console.log('API_KEY:', apiKey || 'not found');
  
  // Get a required secret (throws if not found)
  try {
    const secretKey = secrets.getRequired('SECRET_KEY');
    console.log('SECRET_KEY:', secretKey);
  } catch (error) {
    console.error('Required secret not found:', error.message);
  }
  
  // Get with default value
  const port = secrets.getWithDefault('PORT', '3000');
  console.log('PORT:', port);
  
  // Check if a secret exists
  if (secrets.has('DATABASE_URL')) {
    console.log('Database URL is configured');
  } else {
    console.log('Database URL not found, using default');
  }
  
  console.log('\n');
}

// ============================================================================
// Example 2: Express Server Configuration
// ============================================================================

function expressConfigExample() {
  console.log('Example 2: Express Server Configuration\n');
  
  const secrets = createSecretLoader('my-api-server');
  
  const config = {
    port: parseInt(secrets.getWithDefault('PORT', '3000')),
    host: secrets.getWithDefault('HOST', '0.0.0.0'),
    jwtSecret: secrets.getRequired('JWT_SECRET'),
    database: {
      url: secrets.getRequired('DATABASE_URL'),
      poolSize: parseInt(secrets.getWithDefault('DB_POOL_SIZE', '10')),
    },
    cors: {
      origins: secrets.getWithDefault('CORS_ORIGINS', '*').split(','),
    },
    logging: {
      level: secrets.getWithDefault('LOG_LEVEL', 'info'),
    },
  };
  
  console.log('Server config:', JSON.stringify(config, null, 2));
  console.log('\n');
}

// ============================================================================
// Example 3: External API Integration
// ============================================================================

class WeatherAPI {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(serviceName: string = 'weather-service') {
    const secrets = createSecretLoader(serviceName);
    
    this.apiKey = secrets.getRequired('WEATHER_API_KEY');
    this.baseUrl = secrets.getWithDefault(
      'WEATHER_API_URL',
      'https://api.weather.com'
    );
  }
  
  async getForecast(location: string): Promise<any> {
    console.log(`Fetching weather for ${location} from ${this.baseUrl}`);
    console.log(`Using API key: ${this.apiKey.substring(0, 8)}...`);
    
    // In a real app, you would make an actual API call here
    return {
      location,
      temperature: 72,
      conditions: 'Partly Cloudy',
    };
  }
}

function externalApiExample() {
  console.log('Example 3: External API Integration\n');
  
  try {
    const weatherAPI = new WeatherAPI('flight-planner');
    // weatherAPI.getForecast('KSFO').then(console.log);
    console.log('Weather API initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Weather API:', error.message);
  }
  
  console.log('\n');
}

// ============================================================================
// Example 4: Database Configuration
// ============================================================================

function databaseConfigExample() {
  console.log('Example 4: Database Configuration\n');
  
  const secrets = createSecretLoader('database-service');
  
  // PostgreSQL configuration
  const dbConfig = {
    type: 'postgres',
    host: secrets.getRequired('DB_HOST'),
    port: parseInt(secrets.getWithDefault('DB_PORT', '5432')),
    username: secrets.getRequired('DB_USERNAME'),
    password: secrets.getRequired('DB_PASSWORD'),
    database: secrets.getRequired('DB_NAME'),
    ssl: secrets.get('DB_SSL') === 'true',
    pool: {
      min: parseInt(secrets.getWithDefault('DB_POOL_MIN', '2')),
      max: parseInt(secrets.getWithDefault('DB_POOL_MAX', '10')),
    },
  };
  
  console.log('Database config:', {
    ...dbConfig,
    password: '***REDACTED***',
  });
  
  console.log('\n');
}

// ============================================================================
// Example 5: Advanced - Direct KeyStore Usage
// ============================================================================

function advancedKeystoreExample() {
  console.log('Example 5: Advanced KeyStore Usage\n');
  
  // Create a keystore instance with custom configuration
  const keystore = new SecureKeyStore({
    storePath: '/Users/jkh/Src/Aviation/.keystore',
    encryptionKey: process.env.KEYSTORE_ENCRYPTION_KEY,
  });
  
  // List all keys for a service
  const keys = keystore.listKeys('foreflight-dashboard');
  console.log('Keys for foreflight-dashboard:', keys);
  
  // Get a specific secret
  const secretKey = keystore.getSecret('foreflight-dashboard', 'SECRET_KEY');
  console.log('SECRET_KEY:', secretKey);
  
  // You can also set secrets programmatically (be careful with this!)
  // keystore.setSecret('my-service', 'RUNTIME_TOKEN', 'generated-token');
  
  console.log('\n');
}

// ============================================================================
// Example 6: Migration from Environment Variables
// ============================================================================

function migrationExample() {
  console.log('Example 6: Migration from process.env\n');
  
  const secrets = createSecretLoader('legacy-app', {
    fallbackToEnv: true, // Enable fallback (default behavior)
  });
  
  // This will check keystore first, then fall back to process.env
  // Great for gradual migration!
  const apiKey = secrets.get('API_KEY');
  const dbUrl = secrets.get('DATABASE_URL');
  
  console.log('API_KEY found:', !!apiKey);
  console.log('DATABASE_URL found:', !!dbUrl);
  
  console.log('\n');
  console.log('To migrate, just move values from .env to keystore:');
  console.log('  npm run keystore set legacy-app API_KEY "your-key"');
  console.log('\n');
}

// ============================================================================
// Example 7: Error Handling
// ============================================================================

function errorHandlingExample() {
  console.log('Example 7: Error Handling\n');
  
  const secrets = createSecretLoader('my-service');
  
  // Graceful degradation with optional secrets
  const optionalFeature = secrets.get('OPTIONAL_API_KEY');
  if (optionalFeature) {
    console.log('Optional feature enabled');
  } else {
    console.log('Optional feature disabled (no API key)');
  }
  
  // Required secrets with clear error messages
  try {
    const critical = secrets.getRequired('CRITICAL_SECRET');
    console.log('Critical secret loaded');
  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
    console.error('Please run: npm run keystore set my-service CRITICAL_SECRET "value"');
    // In a real app, you might exit here: process.exit(1);
  }
  
  console.log('\n');
}

// ============================================================================
// Example 8: Multi-Service Application
// ============================================================================

class MultiServiceApp {
  private mainSecrets: any;
  private weatherSecrets: any;
  private dbSecrets: any;
  
  constructor() {
    // Different loaders for different services
    this.mainSecrets = createSecretLoader('main-app');
    this.weatherSecrets = createSecretLoader('weather-service');
    this.dbSecrets = createSecretLoader('database');
  }
  
  initialize() {
    console.log('Initializing multi-service application...\n');
    
    // Each loader manages its own namespace
    const appSecret = this.mainSecrets.get('APP_SECRET');
    const weatherKey = this.weatherSecrets.get('WEATHER_API_KEY');
    const dbPassword = this.dbSecrets.get('DB_PASSWORD');
    
    console.log('Main app secret:', appSecret ? '✓ loaded' : '✗ missing');
    console.log('Weather API key:', weatherKey ? '✓ loaded' : '✗ missing');
    console.log('DB password:', dbPassword ? '✓ loaded' : '✗ missing');
  }
}

function multiServiceExample() {
  console.log('Example 8: Multi-Service Application\n');
  
  const app = new MultiServiceApp();
  app.initialize();
  
  console.log('\n');
}

// ============================================================================
// Run Examples
// ============================================================================

if (require.main === module) {
  console.log('🔐 Aviation Keystore Integration Examples');
  console.log('═'.repeat(60));
  console.log('\n');
  
  try {
    basicLoaderExample();
    // expressConfigExample();
    externalApiExample();
    // databaseConfigExample();
    advancedKeystoreExample();
    migrationExample();
    errorHandlingExample();
    // multiServiceExample();
    
    console.log('═'.repeat(60));
    console.log('\n✅ All examples completed!\n');
    console.log('Next steps:');
    console.log('  1. Review the examples above');
    console.log('  2. Integrate into your application');
    console.log('  3. Migrate secrets: npm run secrets:migrate');
    console.log('  4. Test your application\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error.message);
    process.exit(1);
  }
}

export {
  WeatherAPI,
  MultiServiceApp,
};

