# Event Table Component Implementation Spec

**Bead:** [Aviation-6f2] Implement event table with sorting and pagination
**Priority:** P0 - MVP Blocker
**Effort:** 2 days
**Dependencies:**
- Frontend infrastructure (React, MUI, API client)
- Backend API (GET /api/events)

---

## Overview

Implement a responsive, sortable, paginated table component to display aviation accident/incident events with key information and actions.

---

## Target Implementation

### File Structure

```
apps/aviation-accident-tracker/frontend/src/
├── components/
│   ├── EventTable.tsx              # Main table component
│   ├── EventTableRow.tsx           # Individual row component
│   ├── EventTableHeader.tsx        # Table header with sorting
│   ├── EventTablePagination.tsx    # Pagination controls
│   └── EventTable.test.tsx         # Component tests
├── hooks/
│   ├── useEvents.ts                # Data fetching hook
│   └── useTableState.ts            # Table state management
└── types/
    └── event.ts                    # Event type definitions
```

---

## Component Design

### Event Type Definition

```typescript
// apps/aviation-accident-tracker/frontend/src/types/event.ts

export interface Event {
  id: number;
  external_id: string;
  source: 'ASN' | 'AVHerald';
  date_time: string;              // ISO 8601
  aircraft_type: string;
  registration?: string;
  operator?: string;
  flight_number?: string;
  route?: string;
  location: string;
  airport_code?: string;
  latitude?: number;
  longitude?: number;
  phase_of_flight?: string;
  fatalities: number;
  injuries: number;
  damage?: string;
  description: string;
  category?: 'Commercial' | 'GA' | 'Unknown';
  investigation_status?: string;
  source_url?: string;
}

export interface EventsResponse {
  events: Event[];
  total: number;
  page: number;
  limit: number;
}

export type SortField = 
  | 'date_time'
  | 'aircraft_type'
  | 'operator'
  | 'location'
  | 'fatalities'
  | 'category';

export type SortOrder = 'asc' | 'desc';
```

---

### Main Table Component

```tsx
// apps/aviation-accident-tracker/frontend/src/components/EventTable.tsx

import React from 'react';
import {
  Table,
  TableContainer,
  Paper,
  CircularProgress,
  Alert,
  Box,
  Typography
} from '@mui/material';
import { EventTableHeader } from './EventTableHeader';
import { EventTableRow } from './EventTableRow';
import { EventTablePagination } from './EventTablePagination';
import { useEvents } from '../hooks/useEvents';
import { useTableState } from '../hooks/useTableState';
import type { Event } from '../types/event';

export interface EventTableProps {
  filters?: Record<string, any>;
  onEventClick?: (event: Event) => void;
  onEventHover?: (event: Event | null) => void;
}

/**
 * Event table with sorting, pagination, and selection
 * 
 * @example
 * ```tsx
 * <EventTable
 *   filters={{ category: 'Commercial', minFatalities: 1 }}
 *   onEventClick={(event) => openDetailModal(event)}
 *   onEventHover={(event) => highlightOnMap(event)}
 * />
 * ```
 */
export function EventTable({
  filters = {},
  onEventClick,
  onEventHover
}: EventTableProps) {
  const {
    page,
    limit,
    sortField,
    sortOrder,
    setPage,
    setLimit,
    setSort
  } = useTableState();

  const {
    events,
    total,
    loading,
    error,
    refetch
  } = useEvents({
    page,
    limit,
    sortField,
    sortOrder,
    filters
  });

  if (loading && events.length === 0) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load events: {error.message}
      </Alert>
    );
  }

  if (events.length === 0) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No events found. Try adjusting your filters or ingest new data.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ p: 2 }}>
        {total.toLocaleString()} Events
      </Typography>

      <TableContainer component={Paper}>
        <Table stickyHeader>
          <EventTableHeader
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={setSort}
          />

          <tbody>
            {events.map((event) => (
              <EventTableRow
                key={event.id}
                event={event}
                onClick={() => onEventClick?.(event)}
                onMouseEnter={() => onEventHover?.(event)}
                onMouseLeave={() => onEventHover?.(null)}
              />
            ))}
          </tbody>
        </Table>
      </TableContainer>

      <EventTablePagination
        total={total}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
    </Box>
  );
}
```

---

### Table Header Component

```tsx
// apps/aviation-accident-tracker/frontend/src/components/EventTableHeader.tsx

import React from 'react';
import {
  TableHead,
  TableRow,
  TableCell,
  TableSortLabel
} from '@mui/material';
import type { SortField, SortOrder } from '../types/event';

export interface EventTableHeaderProps {
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}

const columns: Array<{ field: SortField; label: string; width?: string }> = [
  { field: 'date_time', label: 'Date/Time', width: '140px' },
  { field: 'aircraft_type', label: 'Aircraft', width: '150px' },
  { field: 'operator', label: 'Operator', width: '120px' },
  { field: 'location', label: 'Location', width: '200px' },
  { field: 'fatalities', label: 'Fatalities', width: '100px' },
  { field: 'category', label: 'Category', width: '100px' }
];

export function EventTableHeader({
  sortField,
  sortOrder,
  onSort
}: EventTableHeaderProps) {
  return (
    <TableHead>
      <TableRow>
        {columns.map((col) => (
          <TableCell
            key={col.field}
            sortDirection={sortField === col.field ? sortOrder : false}
            sx={{ width: col.width, fontWeight: 'bold' }}
          >
            <TableSortLabel
              active={sortField === col.field}
              direction={sortField === col.field ? sortOrder : 'asc'}
              onClick={() => onSort(col.field)}
            >
              {col.label}
            </TableSortLabel>
          </TableCell>
        ))}
        <TableCell sx={{ width: '80px', fontWeight: 'bold' }}>
          Source
        </TableCell>
      </TableRow>
    </TableHead>
  );
}
```

---

### Table Row Component

```tsx
// apps/aviation-accident-tracker/frontend/src/components/EventTableRow.tsx

import React from 'react';
import { TableRow, TableCell, Chip, Tooltip, IconButton } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import type { Event } from '../types/event';

export interface EventTableRowProps {
  event: Event;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function EventTableRow({
  event,
  onClick,
  onMouseEnter,
  onMouseLeave
}: EventTableRowProps) {
  const formattedDate = new Date(event.date_time).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short'
  });

  const categoryColor = {
    Commercial: 'error',
    GA: 'primary',
    Unknown: 'default'
  }[event.category || 'Unknown'] as any;

  return (
    <TableRow
      hover
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      sx={{
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'action.hover'
        }
      }}
    >
      <TableCell>
        <Tooltip title={event.date_time}>
          <span>{formattedDate}</span>
        </Tooltip>
      </TableCell>

      <TableCell>
        <strong>{event.aircraft_type}</strong>
        {event.registration && (
          <div style={{ fontSize: '0.85em', color: 'text.secondary' }}>
            {event.registration}
          </div>
        )}
      </TableCell>

      <TableCell>
        {event.operator || '—'}
        {event.flight_number && (
          <div style={{ fontSize: '0.85em', color: 'text.secondary' }}>
            {event.flight_number}
          </div>
        )}
      </TableCell>

      <TableCell>
        {event.location}
        {event.airport_code && (
          <Chip
            label={event.airport_code}
            size="small"
            variant="outlined"
            sx={{ ml: 1, height: '20px', fontSize: '0.75em' }}
          />
        )}
      </TableCell>

      <TableCell align="center">
        {event.fatalities > 0 ? (
          <Chip
            label={event.fatalities}
            color="error"
            size="small"
            sx={{ minWidth: '40px' }}
          />
        ) : (
          <span style={{ color: 'text.secondary' }}>0</span>
        )}
      </TableCell>

      <TableCell>
        <Chip
          label={event.category || 'Unknown'}
          color={categoryColor}
          size="small"
          variant="outlined"
        />
      </TableCell>

      <TableCell align="center">
        <Tooltip title={`View on ${event.source}`}>
          <Chip
            label={event.source}
            size="small"
            sx={{ minWidth: '60px' }}
          />
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}
```

---

### Pagination Component

```tsx
// apps/aviation-accident-tracker/frontend/src/components/EventTablePagination.tsx

import React from 'react';
import {
  TablePagination,
  Box
} from '@mui/material';

export interface EventTablePaginationProps {
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function EventTablePagination({
  total,
  page,
  limit,
  onPageChange,
  onLimitChange
}: EventTablePaginationProps) {
  return (
    <Box>
      <TablePagination
        component="div"
        count={total}
        page={page - 1} // MUI uses 0-indexed pages
        onPageChange={(_, newPage) => onPageChange(newPage + 1)}
        rowsPerPage={limit}
        onRowsPerPageChange={(e) => {
          onLimitChange(parseInt(e.target.value, 10));
          onPageChange(1); // Reset to first page
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
        labelRowsPerPage="Events per page:"
      />
    </Box>
  );
}
```

---

### Data Fetching Hook

```typescript
// apps/aviation-accident-tracker/frontend/src/hooks/useEvents.ts

import { useState, useEffect } from 'react';
import type { Event, SortField, SortOrder } from '../types/event';

export interface UseEventsOptions {
  page: number;
  limit: number;
  sortField: SortField;
  sortOrder: SortOrder;
  filters: Record<string, any>;
}

export interface UseEventsResult {
  events: Event[];
  total: number;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useEvents(options: UseEventsOptions): UseEventsResult {
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams({
        page: options.page.toString(),
        limit: options.limit.toString(),
        sort: options.sortField,
        order: options.sortOrder,
        ...options.filters
      });

      const response = await fetch(`/api/events?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`);
      }

      const data = await response.json();

      setEvents(data.events);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [
    options.page,
    options.limit,
    options.sortField,
    options.sortOrder,
    JSON.stringify(options.filters)
  ]);

  return {
    events,
    total,
    loading,
    error,
    refetch: fetchEvents
  };
}
```

---

### Table State Hook

```typescript
// apps/aviation-accident-tracker/frontend/src/hooks/useTableState.ts

import { useState, useCallback } from 'react';
import type { SortField, SortOrder } from '../types/event';

export interface TableState {
  page: number;
  limit: number;
  sortField: SortField;
  sortOrder: SortOrder;
}

export interface UseTableStateResult extends TableState {
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSort: (field: SortField) => void;
  reset: () => void;
}

const initialState: TableState = {
  page: 1,
  limit: 25,
  sortField: 'date_time',
  sortOrder: 'desc'
};

export function useTableState(
  initial: Partial<TableState> = {}
): UseTableStateResult {
  const [state, setState] = useState<TableState>({
    ...initialState,
    ...initial
  });

  const setPage = useCallback((page: number) => {
    setState(prev => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setState(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  const setSort = useCallback((field: SortField) => {
    setState(prev => ({
      ...prev,
      sortField: field,
      sortOrder:
        prev.sortField === field && prev.sortOrder === 'asc'
          ? 'desc'
          : 'asc'
    }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...initialState, ...initial });
  }, [initial]);

  return {
    ...state,
    setPage,
    setLimit,
    setSort,
    reset
  };
}
```

---

## Responsive Design

### Mobile Layout

```tsx
// Alternative mobile-friendly card view
// Use when screen width < 768px

import { Card, CardContent, Typography, Box } from '@mui/material';

export function EventCard({ event }: { event: Event }) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography variant="subtitle2">
            {new Date(event.date_time).toLocaleDateString()}
          </Typography>
          <Chip label={event.source} size="small" />
        </Box>

        <Typography variant="h6" gutterBottom>
          {event.aircraft_type}
        </Typography>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {event.location}
        </Typography>

        {event.fatalities > 0 && (
          <Chip
            label={`${event.fatalities} fatalities`}
            color="error"
            size="small"
            sx={{ mt: 1 }}
          />
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Testing Requirements

### Component Tests

```typescript
// apps/aviation-accident-tracker/frontend/src/components/EventTable.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventTable } from './EventTable';

const mockEvents = [
  {
    id: 1,
    external_id: 'asn-20260113-0',
    source: 'ASN',
    date_time: '2026-01-13T14:30:00Z',
    aircraft_type: 'Boeing 737-800',
    registration: 'N12345',
    operator: 'United Airlines',
    location: 'San Francisco International Airport',
    airport_code: 'KSFO',
    fatalities: 0,
    injuries: 0,
    description: 'Hard landing',
    category: 'Commercial'
  }
];

describe('EventTable', () => {
  test('renders events', async () => {
    render(<EventTable />);

    await waitFor(() => {
      expect(screen.getByText('Boeing 737-800')).toBeInTheDocument();
    });
  });

  test('handles sorting', async () => {
    render(<EventTable />);

    const dateHeader = screen.getByText('Date/Time');
    fireEvent.click(dateHeader);

    // Verify sort order changed
  });

  test('handles pagination', async () => {
    render(<EventTable />);

    const nextButton = screen.getByLabelText('Go to next page');
    fireEvent.click(nextButton);

    // Verify page changed
  });

  test('calls onEventClick when row clicked', async () => {
    const handleClick = jest.fn();
    render(<EventTable onEventClick={handleClick} />);

    const row = screen.getByText('Boeing 737-800').closest('tr');
    fireEvent.click(row!);

    expect(handleClick).toHaveBeenCalled();
  });

  test('displays loading state', () => {
    render(<EventTable />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('displays error state', async () => {
    // Mock API error
    render(<EventTable />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });
  });

  test('displays empty state', async () => {
    // Mock empty response
    render(<EventTable />);

    await waitFor(() => {
      expect(screen.getByText(/No events found/)).toBeInTheDocument();
    });
  });
});
```

---

## Acceptance Criteria

- [ ] Table displays events with all key columns
- [ ] Sorting works for all sortable columns
- [ ] Pagination works (prev/next, page size)
- [ ] Row click opens detail modal
- [ ] Row hover highlights event on map
- [ ] Loading state displayed during fetch
- [ ] Error state displayed on fetch failure
- [ ] Empty state displayed when no events
- [ ] Responsive on mobile (< 768px)
- [ ] Keyboard navigation works
- [ ] Tests passing (>70% coverage)

---

## Timeline

**Day 1:**
- EventTable component
- EventTableHeader with sorting
- EventTableRow with formatting
- useEvents hook

**Day 2:**
- EventTablePagination
- useTableState hook
- Responsive design
- Tests and polish

---

**Status:** Ready for implementation
**Dependencies:** Frontend infrastructure, Backend API
**Target Completion:** 2 days
