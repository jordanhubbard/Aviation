# Event Detail Modal Component Implementation Spec

**Bead:** [Aviation-c8f] Implement event detail modal
**Priority:** P1 - High Priority
**Effort:** 1-2 days
**Dependencies:**
- Frontend infrastructure (React, MUI)
- Event table component (Aviation-6f2)
- Backend API (GET /api/events/:id)

---

## Overview

Implement a comprehensive modal dialog that displays full details of a selected aviation accident/incident event, including metadata, description, investigation status, and a link to the source.

---

## Target Implementation

### File Structure

```
apps/aviation-accident-tracker/frontend/src/
├── components/
│   ├── EventDetailModal.tsx         # Main modal component
│   ├── EventDetailHeader.tsx        # Modal header with title/close
│   ├── EventDetailBody.tsx          # Main content area
│   ├── EventDetailMetadata.tsx      # Metadata grid
│   ├── EventDetailMap.tsx           # Mini map showing location
│   └── EventDetailModal.test.tsx    # Component tests
└── hooks/
    └── useEventDetail.ts             # Data fetching hook
```

---

## Component Design

### Main Modal Component

```tsx
// apps/aviation-accident-tracker/frontend/src/components/EventDetailModal.tsx

import React from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import { EventDetailHeader } from './EventDetailHeader';
import { EventDetailBody } from './EventDetailBody';
import { useEventDetail } from '../hooks/useEventDetail';
import type { Event } from '../types/event';

export interface EventDetailModalProps {
  eventId: number | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Event detail modal with full accident/incident information
 * 
 * @example
 * ```tsx
 * const [selectedId, setSelectedId] = useState<number | null>(null);
 * 
 * <EventDetailModal
 *   eventId={selectedId}
 *   open={selectedId !== null}
 *   onClose={() => setSelectedId(null)}
 * />
 * ```
 */
export function EventDetailModal({
  eventId,
  open,
  onClose
}: EventDetailModalProps) {
  const { event, loading, error } = useEventDetail(eventId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      {loading && (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          Failed to load event details: {error.message}
        </Alert>
      )}

      {event && (
        <>
          <EventDetailHeader event={event} onClose={onClose} />
          <DialogContent dividers>
            <EventDetailBody event={event} />
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}
```

---

### Modal Header

```tsx
// apps/aviation-accident-tracker/frontend/src/components/EventDetailHeader.tsx

import React from 'react';
import {
  DialogTitle,
  IconButton,
  Box,
  Chip,
  Typography,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenIcon
} from '@mui/icons-material';
import type { Event } from '../types/event';

export interface EventDetailHeaderProps {
  event: Event;
  onClose: () => void;
}

export function EventDetailHeader({ event, onClose }: EventDetailHeaderProps) {
  const categoryColor = {
    Commercial: 'error',
    GA: 'primary',
    Unknown: 'default'
  }[event.category || 'Unknown'] as any;

  return (
    <DialogTitle>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between">
        <Box flex={1}>
          <Typography variant="h6" component="div" gutterBottom>
            {event.aircraft_type}
            {event.registration && (
              <Typography
                component="span"
                variant="subtitle1"
                color="text.secondary"
                sx={{ ml: 1 }}
              >
                ({event.registration})
              </Typography>
            )}
          </Typography>

          <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
            <Chip
              label={event.category || 'Unknown'}
              color={categoryColor}
              size="small"
            />
            <Chip
              label={event.source}
              size="small"
              variant="outlined"
            />
            {event.fatalities > 0 && (
              <Chip
                label={`${event.fatalities} fatalities`}
                color="error"
                size="small"
              />
            )}
            {event.source_url && (
              <Tooltip title="View original source">
                <IconButton
                  size="small"
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <OpenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ ml: 1 }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
    </DialogTitle>
  );
}
```

---

### Modal Body

```tsx
// apps/aviation-accident-tracker/frontend/src/components/EventDetailBody.tsx

import React from 'react';
import { Box, Typography, Divider, Link } from '@mui/material';
import { EventDetailMetadata } from './EventDetailMetadata';
import { EventDetailMap } from './EventDetailMap';
import type { Event } from '../types/event';

export interface EventDetailBodyProps {
  event: Event;
}

export function EventDetailBody({ event }: EventDetailBodyProps) {
  const formattedDate = new Date(event.date_time).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  });

  return (
    <Box>
      {/* Date/Time */}
      <Box mb={2}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Date & Time
        </Typography>
        <Typography variant="body1">{formattedDate}</Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Location with Map */}
      <Box mb={2}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Location
        </Typography>
        <Typography variant="body1" gutterBottom>
          {event.location}
          {event.airport_code && (
            <Typography
              component="span"
              variant="body2"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              ({event.airport_code})
            </Typography>
          )}
        </Typography>

        {event.latitude && event.longitude && (
          <Box mt={1}>
            <EventDetailMap
              latitude={event.latitude}
              longitude={event.longitude}
              title={event.location}
            />
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Metadata Grid */}
      <EventDetailMetadata event={event} />

      <Divider sx={{ my: 2 }} />

      {/* Description */}
      <Box mb={2}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Description
        </Typography>
        <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
          {event.description || 'No description available.'}
        </Typography>
      </Box>

      {event.investigation_status && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box mb={2}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Investigation Status
            </Typography>
            <Typography variant="body2">{event.investigation_status}</Typography>
          </Box>
        </>
      )}

      {/* Source Attribution */}
      <Divider sx={{ my: 2 }} />
      <Box>
        <Typography variant="caption" color="text.secondary">
          Source: {event.source} • ID: {event.external_id}
          {event.source_url && (
            <>
              {' • '}
              <Link
                href={event.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Original
              </Link>
            </>
          )}
        </Typography>
      </Box>
    </Box>
  );
}
```

---

### Metadata Grid

```tsx
// apps/aviation-accident-tracker/frontend/src/components/EventDetailMetadata.tsx

import React from 'react';
import { Grid, Box, Typography } from '@mui/material';
import type { Event } from '../types/event';

export interface EventDetailMetadataProps {
  event: Event;
}

interface MetadataField {
  label: string;
  value: string | number | undefined;
  visible: boolean;
}

export function EventDetailMetadata({ event }: EventDetailMetadataProps) {
  const fields: MetadataField[] = [
    {
      label: 'Operator',
      value: event.operator,
      visible: !!event.operator
    },
    {
      label: 'Flight Number',
      value: event.flight_number,
      visible: !!event.flight_number
    },
    {
      label: 'Route',
      value: event.route,
      visible: !!event.route
    },
    {
      label: 'Phase of Flight',
      value: event.phase_of_flight,
      visible: !!event.phase_of_flight
    },
    {
      label: 'Fatalities',
      value: event.fatalities,
      visible: true
    },
    {
      label: 'Injuries',
      value: event.injuries,
      visible: event.injuries > 0
    },
    {
      label: 'Damage',
      value: event.damage,
      visible: !!event.damage
    },
    {
      label: 'Coordinates',
      value:
        event.latitude && event.longitude
          ? `${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}`
          : undefined,
      visible: !!(event.latitude && event.longitude)
    }
  ];

  const visibleFields = fields.filter(f => f.visible);

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Details
      </Typography>

      <Grid container spacing={2}>
        {visibleFields.map((field) => (
          <Grid item xs={12} sm={6} key={field.label}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {field.label}
              </Typography>
              <Typography variant="body2">
                {field.value || '—'}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
```

---

### Mini Map Component

```tsx
// apps/aviation-accident-tracker/frontend/src/components/EventDetailMap.tsx

import React from 'react';
import { Box } from '@mui/material';

export interface EventDetailMapProps {
  latitude: number;
  longitude: number;
  title?: string;
}

/**
 * Small static map showing event location
 * Uses either Leaflet or static map image service
 */
export function EventDetailMap({
  latitude,
  longitude,
  title
}: EventDetailMapProps) {
  // Option 1: Static map image (simpler, no library needed)
  const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/` +
    `pin-s+ff0000(${longitude},${latitude})/${longitude},${latitude},10,0/` +
    `400x200@2x?access_token=YOUR_MAPBOX_TOKEN`;

  // Option 2: Use Leaflet (if already integrated)
  // Would render <BaseMap> with single marker

  return (
    <Box
      sx={{
        width: '100%',
        height: '200px',
        borderRadius: 1,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider'
      }}
    >
      <img
        src={mapUrl}
        alt={`Map of ${title || 'event location'}`}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </Box>
  );
}
```

---

### Data Fetching Hook

```typescript
// apps/aviation-accident-tracker/frontend/src/hooks/useEventDetail.ts

import { useState, useEffect } from 'react';
import type { Event } from '../types/event';

export interface UseEventDetailResult {
  event: Event | null;
  loading: boolean;
  error: Error | null;
}

export function useEventDetail(eventId: number | null): UseEventDetailResult {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (eventId === null) {
      setEvent(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchEvent = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/events/${eventId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch event: ${response.statusText}`);
        }

        const data = await response.json();
        setEvent(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setEvent(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  return { event, loading, error };
}
```

---

## Backend API Endpoint

```typescript
// apps/aviation-accident-tracker/backend/src/api/routes.ts

// Add GET /api/events/:id endpoint
router.get('/events/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const event = await repository.getById(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    logger.error('Failed to fetch event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## Testing

```typescript
// apps/aviation-accident-tracker/frontend/src/components/EventDetailModal.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventDetailModal } from './EventDetailModal';

const mockEvent = {
  id: 1,
  external_id: 'asn-20260113-0',
  source: 'ASN',
  date_time: '2026-01-13T14:30:00Z',
  aircraft_type: 'Boeing 737-800',
  registration: 'N12345',
  operator: 'United Airlines',
  location: 'San Francisco International Airport',
  airport_code: 'KSFO',
  latitude: 37.62,
  longitude: -122.38,
  fatalities: 0,
  injuries: 0,
  description: 'Hard landing in gusty crosswinds',
  category: 'Commercial',
  source_url: 'https://aviation-safety.net/...'
};

describe('EventDetailModal', () => {
  test('renders event details', async () => {
    render(
      <EventDetailModal
        eventId={1}
        open={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Boeing 737-800')).toBeInTheDocument();
    });

    expect(screen.getByText('(N12345)')).toBeInTheDocument();
    expect(screen.getByText('San Francisco International Airport')).toBeInTheDocument();
    expect(screen.getByText('Hard landing in gusty crosswinds')).toBeInTheDocument();
  });

  test('closes when close button clicked', async () => {
    const handleClose = jest.fn();
    const user = userEvent.setup();

    render(
      <EventDetailModal
        eventId={1}
        open={true}
        onClose={handleClose}
      />
    );

    const closeButton = await screen.findByLabelText('close');
    await user.click(closeButton);

    expect(handleClose).toHaveBeenCalled();
  });

  test('displays loading state', () => {
    render(
      <EventDetailModal
        eventId={1}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('displays error state', async () => {
    // Mock API error
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    render(
      <EventDetailModal
        eventId={1}
        open={true}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });
  });
});
```

---

## Keyboard Navigation

```typescript
// Add keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (open) {
    document.addEventListener('keydown', handleKeyDown);
  }

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}, [open, onClose]);
```

---

## Responsive Design

```tsx
// Mobile-optimized layout
<Dialog
  open={open}
  onClose={onClose}
  maxWidth="md"
  fullWidth
  fullScreen={isMobile} // Full screen on mobile
  scroll="paper"
>
```

---

## Acceptance Criteria

- [ ] Modal displays all event details
- [ ] Header shows aircraft type, registration, chips
- [ ] Body shows date, location, metadata, description
- [ ] Mini map shows event location (if coordinates available)
- [ ] Close button works
- [ ] Escape key closes modal
- [ ] Click outside closes modal (optional)
- [ ] Link to original source works
- [ ] Loading state displayed
- [ ] Error state displayed
- [ ] Responsive on mobile (full screen)
- [ ] Keyboard navigation works
- [ ] Tests passing (>70% coverage)

---

## Timeline

**Day 1:**
- EventDetailModal structure
- EventDetailHeader
- EventDetailBody
- useEventDetail hook
- Backend API endpoint

**Day 2:**
- EventDetailMetadata grid
- EventDetailMap (static image)
- Keyboard navigation
- Mobile responsiveness
- Tests and polish

---

**Status:** Ready for implementation
**Dependencies:** Frontend infrastructure, Event table, Backend API
**Target Completion:** 1-2 days
