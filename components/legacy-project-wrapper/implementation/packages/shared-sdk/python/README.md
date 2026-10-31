# Aviation SDK - Python Package

Python package providing shared utilities and services for aviation applications.

## Features

### Google Calendar Integration

Full OAuth2 and Calendar API integration matching the TypeScript implementation.

**See:** [aviation/integrations/google/README.md](aviation/integrations/google/README.md)

### Weather Services

Weather data services (coming from TypeScript port).

### Logbook validation

`aviation.logbook` provides the Python realization of the Component-owned common
logbook duration contract, including PIC/dual/solo overlap and structured consistency
issues. It shares acceptance vectors with the TypeScript SDK.

```python
from aviation.logbook import LogbookTimeInput, validate_logbook_time

result = validate_logbook_time(LogbookTimeInput(
    total_time=0.8,
    pic_time=0.8,
    solo_time=0.8,
    day_time=0.8,
    pilot_role="PIC",
))
assert result.valid
```

### NOTAM record semantics

`aviation.notam` provides the Python realization of the Component-owned common
NOTAM contract. It normalizes provider records, classifies severity/category,
checks inclusive effective windows, filters route-relevant records, sorts stably,
and formats a conservative abbreviation set using the same acceptance vectors as
the TypeScript SDK.

```python
from aviation.notam import normalize_notam_record

notam = normalize_notam_record({
    "id": "6/1234",
    "location": "KSFO",
    "effectiveStart": "2026-10-31T10:00:00Z",
    "effectiveEnd": "2026-10-31T14:00:00Z",
    "text": "RWY 10L CLSD",
})
assert notam.severity == "critical"
```

Provider transport/authentication and application presentation remain outside this
module.

### MAC task reporting

`aviation.mac_tasks.MacTaskCreator` creates idempotent runtime error tasks in
the MAC hub. Configure `MAC_API_URL` and, when required, `MAC_API_TOKEN`; tasks
default to the `Aviation` project. Test and CI processes stay disabled unless
`MAC_AUTOREPORT_FORCE=1` is set explicitly.

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
