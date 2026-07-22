export * from './ai.js';
export * from './service.js';
export * from './mac/index.js';

// Caching
export * from './cache/index.js';

// Aviation data services
export * from './aviation/airports/index.js';
export type { Airport, AirportSearchResult } from './aviation/airports/types.js';

// Aviation navigation utilities
export * from './aviation/navigation/index.js';

// Aviation weather services
export * from './aviation/weather/index.js';

// Aviation NOTAM services (FAA NOTAM Search API client)
export * from './aviation/notam.js';
// Aviation hazard services (SIGMETs / AIRMETs / TFRs)
export * from './aviation/hazards.js';

// Date/Time utilities
export * from './datetime/index.js';

// Integrations
export * as GoogleCalendar from './integrations/google/index.js';

// OpenClaw in-app chat (server-side only; use from aviation-chat proxy or app backends)
export {
  createOpenClawClient,
  type OpenClawClientConfig,
  type SendMessageParams,
  type SendMessageResult,
} from './openclaw/index.js';
