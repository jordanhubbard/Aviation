import type {
  ServiceDefinition,
  ServiceDefinitionInput,
  ServiceStatus,
  ServiceCategory,
} from './types'

const CATEGORIES = new Set<ServiceCategory>([
  'weather', 'navigation', 'auth', 'monitoring', 'streaming', 'database',
])
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FIELD_KEY = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/
const ENV_VAR = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/

export class ConfigurationValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'ConfigurationValidationError'
  }
}

function requiredText(value: unknown, code: string, label: string): string {
  const result = String(value ?? '').trim()
  if (!result) throw new ConfigurationValidationError(code, `${label} is required`)
  return result
}

/** Validate and canonicalize one provider-neutral service definition. */
export function normalizeServiceDefinition(input: ServiceDefinitionInput): ServiceDefinition {
  const id = String(input.id ?? '').trim().toLowerCase()
  if (!SLUG.test(id)) {
    throw new ConfigurationValidationError('configuration-service-id-invalid', 'service id must be a lowercase slug')
  }
  const category = String(input.category ?? '').trim().toLowerCase() as ServiceCategory
  if (!CATEGORIES.has(category)) {
    throw new ConfigurationValidationError('configuration-category-invalid', 'service category is invalid')
  }
  let docsUrl: string | undefined
  if (input.docsUrl != null && String(input.docsUrl).trim()) {
    docsUrl = String(input.docsUrl).trim()
    try {
      const parsed = new URL(docsUrl)
      if (parsed.protocol !== 'https:') throw new Error('not HTTPS')
    } catch {
      throw new ConfigurationValidationError('configuration-docs-url-invalid', 'docs URL must be HTTPS')
    }
  }
  if (!Array.isArray(input.fields) || input.fields.length === 0) {
    throw new ConfigurationValidationError('configuration-fields-required', 'at least one field is required')
  }
  const fieldKeys = new Set<string>()
  const envVars = new Set<string>()
  const fields = input.fields.map((field) => {
    const key = String(field.key ?? '').trim().toLowerCase()
    if (!FIELD_KEY.test(key)) {
      throw new ConfigurationValidationError('configuration-field-key-invalid', 'field key is invalid')
    }
    if (fieldKeys.has(key)) {
      throw new ConfigurationValidationError('configuration-field-key-duplicate', 'field key is duplicated')
    }
    fieldKeys.add(key)
    const envVar = String(field.envVar ?? '').trim().toUpperCase()
    if (!ENV_VAR.test(envVar)) {
      throw new ConfigurationValidationError('configuration-env-var-invalid', 'environment variable is invalid')
    }
    if (envVars.has(envVar)) {
      throw new ConfigurationValidationError('configuration-env-var-duplicate', 'environment variable is duplicated')
    }
    envVars.add(envVar)
    if (typeof field.required !== 'boolean' || typeof field.secret !== 'boolean') {
      throw new ConfigurationValidationError('configuration-field-flags-invalid', 'field flags must be boolean')
    }
    return {
      key,
      label: requiredText(field.label, 'configuration-field-label-required', 'field label'),
      description: requiredText(field.description, 'configuration-field-description-required', 'field description'),
      required: field.required,
      secret: field.secret,
      envVar,
    }
  })
  if (!Array.isArray(input.appScope) || input.appScope.length === 0) {
    throw new ConfigurationValidationError('configuration-app-scope-required', 'application scope is required')
  }
  const appScope: string[] = []
  for (const rawScope of input.appScope) {
    const scope = String(rawScope ?? '').trim().toLowerCase()
    if (scope !== 'all' && !SLUG.test(scope)) {
      throw new ConfigurationValidationError('configuration-app-scope-invalid', 'application scope is invalid')
    }
    if (!appScope.includes(scope)) appScope.push(scope)
  }
  return {
    id,
    name: requiredText(input.name, 'configuration-service-name-required', 'service name'),
    description: requiredText(input.description, 'configuration-service-description-required', 'service description'),
    category,
    ...(docsUrl ? { docsUrl } : {}),
    fields,
    appScope,
  }
}

/** Normalize a catalog and reject ambiguous ownership. */
export function normalizeServiceCatalog(inputs: ServiceDefinitionInput[]): ServiceDefinition[] {
  const services = inputs.map(normalizeServiceDefinition)
  const ids = new Set<string>()
  const envOwners = new Set<string>()
  for (const service of services) {
    if (ids.has(service.id)) {
      throw new ConfigurationValidationError('configuration-service-id-duplicate', 'service id is duplicated')
    }
    ids.add(service.id)
    for (const field of service.fields) {
      if (envOwners.has(field.envVar)) {
        throw new ConfigurationValidationError('configuration-env-var-duplicate', 'environment variable has multiple owners')
      }
      envOwners.add(field.envVar)
    }
  }
  return services
}

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

export function getServicesByApp(
  appId: string,
  catalog: ServiceDefinition[] = SERVICE_REGISTRY
): ServiceDefinition[] {
  const canonicalAppId = String(appId ?? '').trim().toLowerCase()
  return catalog.filter(
    (service) => service.appScope.includes(canonicalAppId) || service.appScope.includes('all')
  )
}

export function getServiceById(
  id: string,
  catalog: ServiceDefinition[] = SERVICE_REGISTRY
): ServiceDefinition | undefined {
  const canonicalId = String(id ?? '').trim().toLowerCase()
  return catalog.find((service) => service.id === canonicalId)
}

/** Compute value-free configuration status using required fields only. */
export function buildServiceStatus(
  service: ServiceDefinition,
  configuredKeys: Iterable<string>
): ServiceStatus {
  const configured = new Set(Array.from(configuredKeys, (key) => String(key).trim().toLowerCase()))
  const fields = service.fields.map((field) => ({
    key: field.key,
    configured: configured.has(field.key),
  }))
  return {
    id: service.id,
    configured: service.fields.every((field) => !field.required || configured.has(field.key)),
    fields,
  }
}
