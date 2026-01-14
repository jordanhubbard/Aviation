# Aviation SDK - Python Package

Python package providing shared utilities and services for aviation applications.

## Features

### Google Calendar Integration

Full OAuth2 and Calendar API integration matching the TypeScript implementation.

**See:** [aviation/integrations/google/README.md](aviation/integrations/google/README.md)

### Weather Services

Weather data services (coming from TypeScript port).

## Installation

### Development Installation

```bash
cd packages/shared-sdk/python
pip install -e .
```

### Production Installation

```bash
pip install aviation-sdk
```

## Quick Start

### Google Calendar

```python
from aviation.integrations.google import (
    GoogleCalendarAuth,
    GoogleCalendarClient,
    GoogleOAuthConfig,
    CalendarEvent,
    CalendarDateTime,
)

# Configure OAuth
config = GoogleOAuthConfig(
    client_id='your-client-id',
    client_secret='your-client-secret',
    redirect_uri='http://localhost:5000/callback',
)

# Initialize auth
auth = GoogleCalendarAuth(config)

# Get authorization URL
auth_url = auth.get_authorization_url(state='csrf-token')

# Handle callback
credentials = auth.handle_callback(code)

# Create calendar client
client = GoogleCalendarClient(auth, credentials)

# Create event
event = CalendarEvent(
    summary='Flight Training',
    start=CalendarDateTime(dateTime='2026-01-15T10:00:00Z'),
    end=CalendarDateTime(dateTime='2026-01-15T11:00:00Z'),
)

created_event = client.create_event(event)
```

## Documentation

- [Google Calendar Integration](aviation/integrations/google/README.md)

## TypeScript Equivalent

This Python package mirrors the TypeScript SDK at `packages/shared-sdk/src/`.

## License

MIT
