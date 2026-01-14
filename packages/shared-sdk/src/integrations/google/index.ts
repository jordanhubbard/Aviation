/**
 * Google Calendar Integration
 * 
 * Provides OAuth2 authentication and Calendar API access for Google Calendar.
 * 
 * @example
 * ```typescript
 * import { GoogleCalendarAuth, GoogleCalendarClient } from '@aviation/shared-sdk/integrations/google';
 * 
 * // Initialize auth
 * const auth = new GoogleCalendarAuth({
 *   clientId: process.env.GOOGLE_CLIENT_ID!,
 *   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
 *   redirectUri: 'http://localhost:3000/auth/google/callback',
 * });
 * 
 * // Get authorization URL
 * const authUrl = auth.getAuthorizationUrl('state123');
 * 
 * // Exchange code for credentials
 * const credentials = await auth.handleCallback(code);
 * 
 * // Create calendar client
 * const client = new GoogleCalendarClient(auth, credentials);
 * 
 * // Create event
 * const event = await client.createEvent({
 *   summary: 'Flight Training',
 *   description: 'N12345 - Student: John Doe',
 *   start: { dateTime: '2026-01-15T10:00:00Z', timeZone: 'UTC' },
 *   end: { dateTime: '2026-01-15T11:00:00Z', timeZone: 'UTC' },
 * });
 * ```
 */

export {
  GoogleCalendarAuth,
  DEFAULT_SCOPES,
  GOOGLE_OAUTH_ENDPOINTS,
} from './auth';

export {
  GoogleCalendarClient,
} from './calendar';

export {
  formatDateTime,
  parseDateTime,
  createSimpleEvent,
  createRecurringEvent,
  generateRRule,
  addReminder,
  getEventDuration,
  isAllDayEvent,
  isRecurringEvent,
  formatEventDisplay,
} from './utils';

export type {
  GoogleCredentials,
  GoogleOAuthConfig,
  CalendarAttendee,
  CalendarDateTime,
  RecurrenceRule,
  CalendarEvent,
  ListEventsOptions,
  Calendar,
  TokenRefreshResponse,
  GoogleApiError,
} from './types';
