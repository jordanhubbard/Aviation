export type ServiceCategory = 'weather' | 'navigation' | 'auth' | 'monitoring' | 'streaming' | 'database'

export type ServiceFieldDefinition = {
  key: string            // e.g. 'api_key'
  label: string          // e.g. 'API Key'
  description: string
  required: boolean
  secret: boolean        // true = mask the input
  envVar: string         // e.g. 'OPENWEATHERMAP_API_KEY'
}

export type ServiceDefinition = {
  id: string             // e.g. 'openweather'
  name: string           // e.g. 'OpenWeatherMap'
  description: string
  category: ServiceCategory
  docsUrl?: string
  fields: ServiceFieldDefinition[]
  appScope: string[]     // which apps use this: ['flight-planner', 'weather-briefing', 'all']
}

export type ServiceStatus = {
  id: string
  configured: boolean
  fields: { key: string; configured: boolean }[]
}

export type SettingsResponse = {
  services: ServiceStatus[]
}
