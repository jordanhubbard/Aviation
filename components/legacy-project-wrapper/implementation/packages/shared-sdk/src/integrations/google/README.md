# Google Calendar Integration

TypeScript implementation of Google Calendar OAuth2 and API integration, extracted from flightschool for reuse across aviation applications.

## Features

✅ **OAuth2 Authentication**
- Authorization URL generation
- Token exchange from authorization code
- Automatic token refresh
- Token revocation

✅ **Calendar Operations**
- List calendars
- List/get/create/update/delete events
- Quick add events (natural language)
- Recurring events (RFC 5545 RRULE)
- Free/busy queries

✅ **Utilities**
- Date/time formatting helpers
- Recurrence rule generation
- Event duration calculations
- All-day event support

✅ **Type Safety**
- Full TypeScript types
- Comprehensive interfaces
- Type-safe API responses

## Installation

```bash
npm install @aviation/shared-sdk
```

## Quick Start

### 1. OAuth2 Setup

```typescript
import { GoogleCalendar } from '@aviation/shared-sdk';

// Initialize auth
const auth = new GoogleCalendar.GoogleCalendarAuth({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/google/callback',
});

// Get authorization URL
const authUrl = auth.getAuthorizationUrl('state-for-csrf-protection');
// Redirect user to authUrl

// After user authorizes, handle callback
const credentials = await auth.handleCallback(codeFromCallback);
// Store credentials securely (e.g., in keystore or database)
```

### 2. Create Calendar Client

```typescript
// Create client with credentials
const client = new GoogleCalendar.GoogleCalendarClient(auth, credentials);

// Client automatically refreshes tokens as needed
```

### 3. Create Events

```typescript
// Simple event
const event = await client.createEvent({
  summary: 'Flight Training - N12345',
  description: 'Student: John Doe\\nInstructor: Jane Smith',
  start: {
    dateTime: '2026-01-15T10:00:00Z',
    timeZone: 'America/Los_Angeles',
  },
  end: {
    dateTime: '2026-01-15T11:00:00Z',
    timeZone: 'America/Los_Angeles',
  },
  location: 'KSFO - San Francisco International Airport',
});

console.log(`Event created: ${event.id}`);
```

### 4. List Events

```typescript
const events = await client.listEvents('primary', {
  timeMin: new Date(),
  timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
  maxResults: 10,
  orderBy: 'startTime',
});

for (const event of events) {
  console.log(`${event.summary}: ${event.start.dateTime}`);
}
```

## Advanced Usage

### Recurring Events

```typescript
import { GoogleCalendar } from '@aviation/shared-sdk';

// Weekly recurring lesson
const event = GoogleCalendar.createRecurringEvent(
  'Weekly Flight Lesson',
  new Date('2026-01-15T10:00:00Z'),
  new Date('2026-01-15T11:00:00Z'),
  {
    freq: 'WEEKLY',
    count: 10, // 10 lessons
    byDay: ['TU', 'TH'], // Tuesdays and Thursdays
  },
  {
    description: 'Recurring flight instruction',
    location: 'KSFO',
    timeZone: 'America/Los_Angeles',
  }
);

await client.createEvent(event);
```

### All-Day Events

```typescript
import { GoogleCalendar } from '@aviation/shared-sdk';

const event = GoogleCalendar.createSimpleEvent(
  'Aviation Conference',
  new Date('2026-01-15'),
  new Date('2026-01-17'),
  {
    description: 'Three-day aviation conference',
    location: 'Las Vegas, NV',
    allDay: true,
  }
);

await client.createEvent(event);
```

### Event Reminders

```typescript
import { GoogleCalendar } from '@aviation/shared-sdk';

let event = GoogleCalendar.createSimpleEvent(
  'Checkride',
  new Date('2026-01-15T10:00:00Z'),
  new Date('2026-01-15T12:00:00Z')
);

// Add reminders
GoogleCalendar.addReminder(event, 1440, 'email'); // 1 day before
GoogleCalendar.addReminder(event, 60, 'popup'); // 1 hour before

await client.createEvent(event);
```

### Token Management

```typescript
// Check if token is valid
if (!auth.isTokenValid(credentials)) {
  // Refresh automatically
  credentials = await auth.refreshAccessToken(credentials.refresh_token!);
  // Save updated credentials
}

// Or use ensureValidCredentials helper
credentials = await auth.ensureValidCredentials(credentials);
```

### Update/Delete Events

```typescript
// Update event
await client.updateEvent(eventId, {
  summary: 'Updated Flight Training',
  start: { dateTime: '2026-01-15T11:00:00Z' },
  end: { dateTime: '2026-01-15T12:00:00Z' },
});

// Partial update (PATCH)
await client.patchEvent(eventId, {
  summary: 'New Title',
});

// Delete event
await client.deleteEvent(eventId);
```

### Free/Busy Queries

```typescript
const freeBusy = await client.getFreeBusy(
  new Date('2026-01-15T00:00:00Z'),
  new Date('2026-01-15T23:59:59Z'),
  [{ id: 'primary' }, { id: 'instructor@example.com' }]
);

console.log('Busy times:', freeBusy);
```

## API Reference

### Classes

#### `GoogleCalendarAuth`

OAuth2 authentication handler.

**Constructor:**
```typescript
new GoogleCalendarAuth(config: GoogleOAuthConfig)
```

**Methods:**
- `getAuthorizationUrl(state?: string): string`
- `handleCallback(code: string): Promise<GoogleCredentials>`
- `refreshAccessToken(refreshToken: string): Promise<GoogleCredentials>`
- `revokeToken(token: string): Promise<void>`
- `isTokenValid(credentials: GoogleCredentials): boolean`
- `ensureValidCredentials(credentials: GoogleCredentials): Promise<GoogleCredentials>`

#### `GoogleCalendarClient`

Calendar API client.

**Constructor:**
```typescript
new GoogleCalendarClient(auth: GoogleCalendarAuth, credentials?: GoogleCredentials)
```

**Methods:**
- `listCalendars(): Promise<Calendar[]>`
- `getCalendar(calendarId?: string): Promise<Calendar>`
- `listEvents(calendarId?: string, options?: ListEventsOptions): Promise<CalendarEvent[]>`
- `getEvent(eventId: string, calendarId?: string): Promise<CalendarEvent>`
- `createEvent(event: CalendarEvent, calendarId?: string): Promise<CalendarEvent>`
- `updateEvent(eventId: string, event: CalendarEvent, calendarId?: string): Promise<CalendarEvent>`
- `patchEvent(eventId: string, updates: Partial<CalendarEvent>, calendarId?: string): Promise<CalendarEvent>`
- `deleteEvent(eventId: string, calendarId?: string): Promise<void>`
- `quickAdd(text: string, calendarId?: string): Promise<CalendarEvent>`
- `getFreeBusy(timeMin: Date, timeMax: Date, items: Array<{id: string}>): Promise<any>`

### Utility Functions

- `formatDateTime(date: Date, timeZone?: string, allDay?: boolean): CalendarDateTime`
- `parseDateTime(calendarDateTime: CalendarDateTime): Date`
- `createSimpleEvent(summary, start, end, options?): CalendarEvent`
- `createRecurringEvent(summary, start, end, recurrence, options?): CalendarEvent`
- `generateRRule(rule: RecurrenceRule): string`
- `addReminder(event, minutes, method?): CalendarEvent`
- `getEventDuration(event): number`
- `isAllDayEvent(event): boolean`
- `isRecurringEvent(event): boolean`
- `formatEventDisplay(event): string`

## Security Best Practices

1. **Store credentials securely** - Use keystore or encrypted database
2. **Use HTTPS** - Always use HTTPS for redirect URIs
3. **Validate state parameter** - Prevent CSRF attacks
4. **Rotate tokens** - Refresh tokens expire after 6 months of inactivity
5. **Scope minimization** - Only request required scopes

## Migration from Python

This package replaces the Python implementation in `apps/flightschool/app/calendar_service.py`:

**Python (old):**
```python
service = GoogleCalendarService()
event_id = service.create_event(booking, user)
```

**TypeScript (new):**
```typescript
const event = await client.createEvent({
  summary: `Flight Training - ${booking.aircraft.tail_number}`,
  // ...
});
```

## Testing

```bash
npm test
```

27 tests covering:
- OAuth2 flow
- Token validation
- Event creation/update/deletion
- Recurring events
- All-day events
- Utility functions

## License

MIT
