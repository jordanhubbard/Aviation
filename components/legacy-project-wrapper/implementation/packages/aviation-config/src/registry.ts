import type { ServiceDefinition } from './types'

export const SERVICE_REGISTRY: ServiceDefinition[] = [
  {
    id: 'openweather',
    name: 'OpenWeatherMap',
    description: 'Weather data for flight planning and briefings',
    category: 'weather',
    docsUrl: 'https://openweathermap.org/api',
    fields: [
      { key: 'api_key', label: 'API Key', description: 'Your OpenWeatherMap API key', required: true, secret: true, envVar: 'OPENWEATHERMAP_API_KEY' }
    ],
    appScope: ['flight-planner', 'weather-briefing', 'g1000-simulator'],
  },
  {
    id: 'openaip',
    name: 'OpenAIP',
    description: 'Airspace, airports, and navigation data',
    category: 'navigation',
    docsUrl: 'https://www.openaip.net/',
    fields: [
      { key: 'api_key', label: 'API Key', description: 'Your OpenAIP API key', required: true, secret: true, envVar: 'OPENAIP_API_KEY' }
    ],
    appScope: ['flight-planner', 'g1000-simulator'],
  },
  {
    id: 'opentopography',
    name: 'OpenTopography',
    description: 'Terrain and elevation data for flight planning',
    category: 'navigation',
    docsUrl: 'https://opentopography.org/',
    fields: [
      { key: 'api_key', label: 'API Key', description: 'Your OpenTopography API key', required: false, secret: true, envVar: 'OPENTOPOGRAPHY_API_KEY' }
    ],
    appScope: ['flight-planner'],
  },
  {
    id: 'foreflight',
    name: 'ForeFlight',
    description: 'ForeFlight logbook and flight data API',
    category: 'navigation',
    docsUrl: 'https://developer.foreflight.com/',
    fields: [
      { key: 'api_key', label: 'API Key', description: 'ForeFlight API key', required: true, secret: true, envVar: 'FOREFLIGHT_API_KEY' },
      { key: 'api_secret', label: 'API Secret', description: 'ForeFlight API secret', required: true, secret: true, envVar: 'FOREFLIGHT_API_SECRET' },
    ],
    appScope: ['foreflight-dashboard'],
  },
  {
    id: 'google-oauth',
    name: 'Google OAuth',
    description: 'Google authentication for flight school and calendar',
    category: 'auth',
    docsUrl: 'https://console.cloud.google.com/',
    fields: [
      { key: 'client_id', label: 'Client ID', description: 'Google OAuth client ID', required: true, secret: false, envVar: 'GOOGLE_CLIENT_ID' },
      { key: 'client_secret', label: 'Client Secret', description: 'Google OAuth client secret', required: true, secret: true, envVar: 'GOOGLE_CLIENT_SECRET' },
      { key: 'redirect_uri', label: 'Redirect URI', description: 'OAuth redirect URI', required: false, secret: false, envVar: 'GOOGLE_REDIRECT_URI' },
    ],
    appScope: ['flightschool'],
  },
  {
    id: 'smtp',
    name: 'Email (SMTP)',
    description: 'Email notifications for flight school',
    category: 'monitoring',
    fields: [
      { key: 'server', label: 'SMTP Server', description: 'Mail server hostname', required: true, secret: false, envVar: 'MAIL_SERVER' },
      { key: 'port', label: 'Port', description: 'SMTP port (default: 587)', required: false, secret: false, envVar: 'MAIL_PORT' },
      { key: 'username', label: 'Username', description: 'SMTP username', required: false, secret: false, envVar: 'MAIL_USERNAME' },
      { key: 'password', label: 'Password', description: 'SMTP password', required: false, secret: true, envVar: 'MAIL_PASSWORD' },
    ],
    appScope: ['flightschool'],
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Error tracking and monitoring',
    category: 'monitoring',
    docsUrl: 'https://sentry.io/',
    fields: [
      { key: 'dsn', label: 'DSN', description: 'Sentry DSN URL', required: false, secret: true, envVar: 'SENTRY_DSN' }
    ],
    appScope: ['all'],
  },
  {
    id: 'g1000-stream',
    name: 'G1000 Stream API',
    description: 'API key for G1000 simulator real-time telemetry streaming',
    category: 'streaming',
    fields: [
      { key: 'api_key', label: 'Stream API Key', description: 'G1000 simulator streaming API key', required: false, secret: true, envVar: 'G1000_STREAM_API_KEY' }
    ],
    appScope: ['g1000-simulator'],
  },
  {
    id: 'database',
    name: 'Database',
    description: 'PostgreSQL or SQLite database connection',
    category: 'database',
    fields: [
      { key: 'url', label: 'Database URL', description: 'Connection string (e.g. postgresql://user:pass@host/db)', required: false, secret: true, envVar: 'DATABASE_URL' }
    ],
    appScope: ['flightschool', 'foreflight-dashboard', 'flight-planner'],
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'Redis cache for session and API response caching',
    category: 'database',
    fields: [
      { key: 'url', label: 'Redis URL', description: 'Redis connection URL (e.g. redis://localhost:6379)', required: false, secret: false, envVar: 'REDIS_URL' }
    ],
    appScope: ['foreflight-dashboard', 'flight-planner'],
  },
]

export function getServicesByApp(appId: string): ServiceDefinition[] {
  return SERVICE_REGISTRY.filter(
    (s) => s.appScope.includes(appId) || s.appScope.includes('all')
  )
}

export function getServiceById(id: string): ServiceDefinition | undefined {
  return SERVICE_REGISTRY.find((s) => s.id === id)
}
