/**
 * Google Calendar Integration - Calendar API Client
 */

import type {
  GoogleCredentials,
  CalendarEvent,
  ListEventsOptions,
  Calendar,
  GoogleApiError,
} from './types';
import { GoogleCalendarAuth } from './auth';

/**
 * Google Calendar API base URL
 */
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Google Calendar API client
 */
export class GoogleCalendarClient {
  private auth: GoogleCalendarAuth;
  private credentials?: GoogleCredentials;

  constructor(auth: GoogleCalendarAuth, credentials?: GoogleCredentials) {
    this.auth = auth;
    this.credentials = credentials;
  }

  /**
   * Set credentials for API calls
   */
  setCredentials(credentials: GoogleCredentials): void {
    this.credentials = credentials;
  }

  /**
   * Make authenticated request to Google Calendar API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    // Ensure credentials are valid
    this.credentials = await this.auth.ensureValidCredentials(
      this.credentials
    );

    const response = await fetch(`${CALENDAR_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.credentials.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json() as GoogleApiError;
      throw new Error(
        `Google Calendar API error: ${error.error.message} (${error.error.code})`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * List calendars
   */
  async listCalendars(): Promise<Calendar[]> {
    const data = await this.request<{ items: Calendar[] }>(
      '/users/me/calendarList'
    );
    return data.items || [];
  }

  /**
   * Get a specific calendar
   */
  async getCalendar(calendarId: string = 'primary'): Promise<Calendar> {
    return this.request<Calendar>(`/calendars/${calendarId}`);
  }

  /**
   * List events in a calendar
   * 
   * @param calendarId Calendar ID (default: 'primary')
   * @param options Filter options
   */
  async listEvents(
    calendarId: string = 'primary',
    options: ListEventsOptions = {}
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams();

    if (options.timeMin) {
      params.append(
        'timeMin',
        typeof options.timeMin === 'string'
          ? options.timeMin
          : options.timeMin.toISOString()
      );
    }

    if (options.timeMax) {
      params.append(
        'timeMax',
        typeof options.timeMax === 'string'
          ? options.timeMax
          : options.timeMax.toISOString()
      );
    }

    if (options.maxResults) {
      params.append('maxResults', options.maxResults.toString());
    }

    if (options.orderBy) {
      params.append('orderBy', options.orderBy);
      params.append('singleEvents', 'true'); // Required for orderBy
    }

    if (options.q) {
      params.append('q', options.q);
    }

    if (options.singleEvents !== undefined) {
      params.append('singleEvents', options.singleEvents.toString());
    }

    if (options.showDeleted !== undefined) {
      params.append('showDeleted', options.showDeleted.toString());
    }

    const query = params.toString();
    const endpoint = `/calendars/${calendarId}/events${query ? `?${query}` : ''}`;

    const data = await this.request<{ items: CalendarEvent[] }>(endpoint);
    return data.items || [];
  }

  /**
   * Get a specific event
   */
  async getEvent(
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(
      `/calendars/${calendarId}/events/${eventId}`
    );
  }

  /**
   * Create a new calendar event
   * 
   * @param event Event data
   * @param calendarId Calendar ID (default: 'primary')
   * @returns Created event with ID
   */
  async createEvent(
    event: CalendarEvent,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(
      `/calendars/${calendarId}/events`,
      {
        method: 'POST',
        body: JSON.stringify(event),
      }
    );
  }

  /**
   * Update an existing calendar event
   * 
   * @param eventId Event ID to update
   * @param event Updated event data
   * @param calendarId Calendar ID (default: 'primary')
   * @returns Updated event
   */
  async updateEvent(
    eventId: string,
    event: CalendarEvent,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(
      `/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'PUT',
        body: JSON.stringify(event),
      }
    );
  }

  /**
   * Partially update an event (PATCH)
   * 
   * @param eventId Event ID to update
   * @param updates Partial event data to update
   * @param calendarId Calendar ID (default: 'primary')
   * @returns Updated event
   */
  async patchEvent(
    eventId: string,
    updates: Partial<CalendarEvent>,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(
      `/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
  }

  /**
   * Delete a calendar event
   * 
   * @param eventId Event ID to delete
   * @param calendarId Calendar ID (default: 'primary')
   */
  async deleteEvent(
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<void> {
    await this.request<void>(
      `/calendars/${calendarId}/events/${eventId}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Quick add event using natural language
   * 
   * @param text Natural language text describing the event
   * @param calendarId Calendar ID (default: 'primary')
   * @returns Created event
   * 
   * @example
   * await client.quickAdd('Appointment at Somewhere on June 3rd 10am-10:25am');
   */
  async quickAdd(
    text: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    const params = new URLSearchParams({ text });
    return this.request<CalendarEvent>(
      `/calendars/${calendarId}/events/quickAdd?${params.toString()}`,
      { method: 'POST' }
    );
  }

  /**
   * Get free/busy information for calendars
   * 
   * @param timeMin Start time
   * @param timeMax End time
   * @param items Calendar IDs to check
   * @returns Free/busy information
   */
  async getFreeBusy(
    timeMin: Date | string,
    timeMax: Date | string,
    items: Array<{ id: string }>
  ): Promise<any> {
    const body = {
      timeMin: typeof timeMin === 'string' ? timeMin : timeMin.toISOString(),
      timeMax: typeof timeMax === 'string' ? timeMax : timeMax.toISOString(),
      items,
    };

    return this.request<any>('/freeBusy', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}
