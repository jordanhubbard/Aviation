/**
 * Google Calendar Integration - Type Definitions
 */

/**
 * OAuth2 credentials for Google Calendar
 */
export interface GoogleCredentials {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expiry_date?: number;
  scope?: string;
}

/**
 * OAuth2 configuration
 */
export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

/**
 * Calendar event attendee
 */
export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
}

/**
 * Calendar event date/time
 */
export interface CalendarDateTime {
  dateTime?: string; // ISO 8601 format
  date?: string; // YYYY-MM-DD format for all-day events
  timeZone?: string;
}

/**
 * Recurrence rule (RFC 5545)
 */
export interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  count?: number;
  until?: string; // ISO 8601 date
  interval?: number;
  byDay?: string[]; // ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
}

/**
 * Calendar event
 */
export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: CalendarDateTime;
  end: CalendarDateTime;
  attendees?: CalendarAttendee[];
  recurrence?: string[]; // RFC 5545 RRULE format
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  colorId?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'default' | 'public' | 'private' | 'confidential';
}

/**
 * List events options
 */
export interface ListEventsOptions {
  timeMin?: Date | string;
  timeMax?: Date | string;
  maxResults?: number;
  orderBy?: 'startTime' | 'updated';
  q?: string; // Free text search
  singleEvents?: boolean; // Expand recurring events
  showDeleted?: boolean;
}

/**
 * Calendar metadata
 */
export interface Calendar {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  primary?: boolean;
}

/**
 * Token refresh response
 */
export interface TokenRefreshResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

/**
 * Error response from Google API
 */
export interface GoogleApiError {
  error: {
    code: number;
    message: string;
    status: string;
    details?: any[];
  };
}
