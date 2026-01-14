# Google Calendar Integration (Python)

Python wrapper for Google Calendar OAuth2 and API integration, mirroring the TypeScript implementation.

## Installation

```bash
# The Python package is located in packages/shared-sdk/python/
# Add to your PYTHONPATH or install in development mode
pip install -e packages/shared-sdk/python/
```

### Dependencies

```bash
pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

## Quick Start

### 1. OAuth2 Setup

```python
from aviation.integrations.google import GoogleCalendarAuth, GoogleOAuthConfig

# Initialize auth
config = GoogleOAuthConfig(
    client_id='your-client-id',
    client_secret='your-client-secret',
    redirect_uri='http://localhost:5000/auth/google/callback',
)

auth = GoogleCalendarAuth(config)

# Get authorization URL
auth_url = auth.get_authorization_url(state='csrf-state')
# Redirect user to auth_url

# After user authorizes, handle callback
credentials = auth.handle_callback(code_from_callback, state='csrf-state')
# Store credentials securely
```

### 2. Create Calendar Client

```python
from aviation.integrations.google import GoogleCalendarClient

# Create client with credentials
client = GoogleCalendarClient(auth, credentials)

# Client automatically refreshes tokens as needed
```

### 3. Create Events

```python
from aviation.integrations.google import CalendarEvent, CalendarDateTime

# Create event
event = CalendarEvent(
    summary='Flight Training - N12345',
    description='Student: John Doe\\nInstructor: Jane Smith',
    location='KSFO - San Francisco International Airport',
    start=CalendarDateTime(
        dateTime='2026-01-15T10:00:00Z',
        timeZone='America/Los_Angeles',
    ),
    end=CalendarDateTime(
        dateTime='2026-01-15T11:00:00Z',
        timeZone='America/Los_Angeles',
    ),
)

created_event = client.create_event(event)
print(f"Event created: {created_event.id}")
```

### 4. List Events

```python
from aviation.integrations.google import ListEventsOptions
from datetime import datetime, timedelta

# List upcoming events
options = ListEventsOptions(
    timeMin=datetime.utcnow(),
    timeMax=datetime.utcnow() + timedelta(days=7),
    maxResults=10,
    orderBy='startTime',
)

events = client.list_events('primary', options)
for event in events:
    print(f"{event.summary}: {event.start.dateTime}")
```

## Advanced Usage

### All-Day Events

```python
event = CalendarEvent(
    summary='Aviation Conference',
    start=CalendarDateTime(date='2026-01-15'),
    end=CalendarDateTime(date='2026-01-17'),
    location='Las Vegas, NV',
)

client.create_event(event)
```

### Update/Delete Events

```python
# Update event
updated_event = CalendarEvent(
    summary='Updated Flight Training',
    start=CalendarDateTime(dateTime='2026-01-15T11:00:00Z'),
    end=CalendarDateTime(dateTime='2026-01-15T12:00:00Z'),
)
client.update_event(event_id, updated_event)

# Partial update
client.patch_event(event_id, {'summary': 'New Title'})

# Delete event
client.delete_event(event_id)
```

### Token Management

```python
# Check if token is valid
if not auth.is_token_valid(credentials):
    credentials = auth.refresh_access_token(credentials.refresh_token)
    # Save updated credentials

# Or use helper
credentials = auth.ensure_valid_credentials(credentials)
```

## Migration from Local Implementation

Replace `app/calendar_service.py` with shared SDK:

**Old (calendar_service.py):**
```python
from app.calendar_service import GoogleCalendarService

service = GoogleCalendarService()
event_id = service.create_event(booking, user)
```

**New (shared SDK):**
```python
from aviation.integrations.google import GoogleCalendarAuth, GoogleCalendarClient, GoogleOAuthConfig
from aviation.integrations.google import CalendarEvent, CalendarDateTime

# Initialize once (e.g., in app factory)
config = GoogleOAuthConfig(
    client_id=app.config['GOOGLE_CLIENT_ID'],
    client_secret=app.config['GOOGLE_CLIENT_SECRET'],
    redirect_uri=app.config['GOOGLE_REDIRECT_URI'],
)
auth = GoogleCalendarAuth(config)

# Use in routes
def create_booking_event(booking, credentials):
    client = GoogleCalendarClient(auth, credentials)
    
    event = CalendarEvent(
        summary=f'Flight Training - {booking.aircraft.tail_number}',
        description=f'Student: {booking.student.full_name}\\nInstructor: {booking.instructor.full_name}',
        start=CalendarDateTime(
            dateTime=booking.start_time.isoformat(),
            timeZone='UTC',
        ),
        end=CalendarDateTime(
            dateTime=booking.end_time.isoformat(),
            timeZone='UTC',
        ),
    )
    
    return client.create_event(event)
```

## Flask Integration Example

```python
from flask import Flask, session, redirect, request
from aviation.integrations.google import GoogleCalendarAuth, GoogleCalendarClient, GoogleOAuthConfig, GoogleCredentials

app = Flask(__name__)

# Initialize auth (once at startup)
config = GoogleOAuthConfig(
    client_id=app.config['GOOGLE_CLIENT_ID'],
    client_secret=app.config['GOOGLE_CLIENT_SECRET'],
    redirect_uri=app.config['GOOGLE_REDIRECT_URI'],
)
calendar_auth = GoogleCalendarAuth(config)

@app.route('/auth/google')
def google_auth():
    state = generate_csrf_token()
    session['oauth_state'] = state
    auth_url = calendar_auth.get_authorization_url(state)
    return redirect(auth_url)

@app.route('/auth/google/callback')
def google_callback():
    code = request.args.get('code')
    state = request.args.get('state')
    
    if state != session.get('oauth_state'):
        return 'Invalid state', 400
    
    credentials = calendar_auth.handle_callback(code, state)
    
    # Store credentials in database
    current_user.google_calendar_credentials = credentials.to_dict()
    db.session.commit()
    
    return redirect('/')

def get_calendar_client(user):
    """Helper to get calendar client for user"""
    if not user.google_calendar_credentials:
        return None
    
    credentials = GoogleCredentials.from_dict(user.google_calendar_credentials)
    return GoogleCalendarClient(calendar_auth, credentials)
```

## API Reference

### Classes

- `GoogleCalendarAuth` - OAuth2 authentication handler
- `GoogleCalendarClient` - Calendar API client
- `GoogleOAuthConfig` - OAuth configuration dataclass
- `GoogleCredentials` - Credentials dataclass
- `CalendarEvent` - Event dataclass
- `CalendarDateTime` - Date/time dataclass
- `ListEventsOptions` - List options dataclass

### Methods

**GoogleCalendarAuth:**
- `get_authorization_url(state=None) -> str`
- `handle_callback(code, state=None) -> GoogleCredentials`
- `refresh_access_token(refresh_token) -> GoogleCredentials`
- `is_token_valid(credentials) -> bool`
- `ensure_valid_credentials(credentials) -> GoogleCredentials`

**GoogleCalendarClient:**
- `list_calendars() -> List[Dict]`
- `get_calendar(calendar_id='primary') -> Dict`
- `list_events(calendar_id='primary', options=None) -> List[CalendarEvent]`
- `get_event(event_id, calendar_id='primary') -> CalendarEvent`
- `create_event(event, calendar_id='primary') -> CalendarEvent`
- `update_event(event_id, event, calendar_id='primary') -> CalendarEvent`
- `patch_event(event_id, updates, calendar_id='primary') -> CalendarEvent`
- `delete_event(event_id, calendar_id='primary') -> None`
- `quick_add(text, calendar_id='primary') -> CalendarEvent`
- `get_free_busy(time_min, time_max, items) -> Dict`

## TypeScript Equivalent

This Python implementation mirrors the TypeScript version at:
- `packages/shared-sdk/src/integrations/google/`

Both implementations provide the same API surface for consistency across the monorepo.

## License

MIT
