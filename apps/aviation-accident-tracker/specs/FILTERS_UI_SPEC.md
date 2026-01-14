# Filters UI Component Implementation Spec

**Bead:** [Aviation-czw] Implement filters UI component
**Priority:** P0 - MVP Blocker
**Effort:** 2 days
**Dependencies:**
- Frontend infrastructure (React, MUI)
- Event table component (Aviation-6f2)

---

## Overview

Implement a comprehensive filtering UI that allows users to filter aviation accident/incident events by various criteria including date range, category, source, location, fatalities, and aircraft type.

---

## Target Implementation

### File Structure

```
apps/aviation-accident-tracker/frontend/src/
├── components/
│   ├── Filters.tsx                  # Main filters component
│   ├── FilterPanel.tsx              # Collapsible filter panel
│   ├── DateRangeFilter.tsx          # Date range selector
│   ├── CategoryFilter.tsx           # Category chips
│   ├── SourceFilter.tsx             # Source checkboxes
│   ├── FatalitiesFilter.tsx         # Fatalities slider
│   └── Filters.test.tsx             # Component tests
├── hooks/
│   └── useFilters.ts                # Filter state management
└── types/
    └── filters.ts                    # Filter type definitions
```

---

## Filter Types

```typescript
// apps/aviation-accident-tracker/frontend/src/types/filters.ts

export interface Filters {
  // Date range
  dateFrom?: string;              // ISO 8601 date
  dateTo?: string;                // ISO 8601 date

  // Category
  category?: ('Commercial' | 'GA')[];

  // Source
  source?: ('ASN' | 'AVHerald')[];

  // Location
  location?: string;              // Text search
  airportCode?: string;           // ICAO/IATA code
  country?: string;               // Country name

  // Severity
  minFatalities?: number;
  maxFatalities?: number;
  minInjuries?: number;
  maxInjuries?: number;

  // Aircraft
  aircraftType?: string;          // Text search
  operator?: string;              // Text search

  // Investigation
  investigationStatus?: string;   // Text search
}

export interface FilterState {
  filters: Filters;
  isOpen: boolean;
  hasActiveFilters: boolean;
}
```

---

## Main Filters Component

```tsx
// apps/aviation-accident-tracker/frontend/src/components/Filters.tsx

import React from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
  Divider,
  Chip
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { DateRangeFilter } from './DateRangeFilter';
import { CategoryFilter } from './CategoryFilter';
import { SourceFilter } from './SourceFilter';
import { FatalitiesFilter } from './FatalitiesFilter';
import { useFilters } from '../hooks/useFilters';
import type { Filters as FiltersType } from '../types/filters';

export interface FiltersProps {
  onFiltersChange: (filters: FiltersType) => void;
  initialFilters?: Partial<FiltersType>;
}

/**
 * Filters UI component for accident/incident events
 * 
 * @example
 * ```tsx
 * <Filters
 *   onFiltersChange={(filters) => setFilters(filters)}
 *   initialFilters={{ category: ['Commercial'] }}
 * />
 * ```
 */
export function Filters({
  onFiltersChange,
  initialFilters = {}
}: FiltersProps) {
  const {
    filters,
    hasActiveFilters,
    updateFilter,
    resetFilters
  } = useFilters(initialFilters);

  // Notify parent of changes
  React.useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" display="flex" alignItems="center">
          <FilterIcon sx={{ mr: 1 }} />
          Filters
        </Typography>

        {hasActiveFilters && (
          <Button
            startIcon={<ClearIcon />}
            onClick={resetFilters}
            size="small"
            color="secondary"
          >
            Clear All
          </Button>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Date Range */}
      <Box mb={3}>
        <DateRangeFilter
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={(dateFrom, dateTo) => {
            updateFilter({ dateFrom, dateTo });
          }}
        />
      </Box>

      {/* Category */}
      <Box mb={3}>
        <CategoryFilter
          selected={filters.category || []}
          onChange={(category) => updateFilter({ category })}
        />
      </Box>

      {/* Source */}
      <Box mb={3}>
        <SourceFilter
          selected={filters.source || []}
          onChange={(source) => updateFilter({ source })}
        />
      </Box>

      {/* Fatalities */}
      <Box mb={3}>
        <FatalitiesFilter
          min={filters.minFatalities}
          max={filters.maxFatalities}
          onChange={(minFatalities, maxFatalities) => {
            updateFilter({ minFatalities, maxFatalities });
          }}
        />
      </Box>

      {/* Text Filters */}
      <Box mb={2}>
        <Typography variant="subtitle2" gutterBottom>
          Search
        </Typography>
        
        <TextField
          label="Location"
          value={filters.location || ''}
          onChange={(e) => updateFilter({ location: e.target.value })}
          fullWidth
          size="small"
          sx={{ mb: 1 }}
        />

        <TextField
          label="Airport Code"
          value={filters.airportCode || ''}
          onChange={(e) => updateFilter({ airportCode: e.target.value.toUpperCase() })}
          fullWidth
          size="small"
          sx={{ mb: 1 }}
        />

        <TextField
          label="Aircraft Type"
          value={filters.aircraftType || ''}
          onChange={(e) => updateFilter({ aircraftType: e.target.value })}
          fullWidth
          size="small"
        />
      </Box>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <Box mt={2} pt={2} borderTop={1} borderColor="divider">
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Active Filters:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
            {renderActiveFilters(filters, updateFilter)}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

function renderActiveFilters(
  filters: FiltersType,
  updateFilter: (updates: Partial<FiltersType>) => void
) {
  const chips: React.ReactNode[] = [];

  if (filters.dateFrom || filters.dateTo) {
    chips.push(
      <Chip
        key="date"
        label={`Date: ${filters.dateFrom || '...'} to ${filters.dateTo || '...'}`}
        onDelete={() => updateFilter({ dateFrom: undefined, dateTo: undefined })}
        size="small"
      />
    );
  }

  if (filters.category && filters.category.length > 0) {
    filters.category.forEach(cat => {
      chips.push(
        <Chip
          key={`cat-${cat}`}
          label={cat}
          onDelete={() => {
            const newCat = filters.category?.filter(c => c !== cat);
            updateFilter({ category: newCat?.length ? newCat : undefined });
          }}
          size="small"
        />
      );
    });
  }

  if (filters.source && filters.source.length > 0) {
    filters.source.forEach(src => {
      chips.push(
        <Chip
          key={`src-${src}`}
          label={src}
          onDelete={() => {
            const newSrc = filters.source?.filter(s => s !== src);
            updateFilter({ source: newSrc?.length ? newSrc : undefined });
          }}
          size="small"
        />
      );
    });
  }

  if (filters.minFatalities !== undefined) {
    chips.push(
      <Chip
        key="fatalities"
        label={`Fatalities ≥ ${filters.minFatalities}`}
        onDelete={() => updateFilter({ minFatalities: undefined })}
        size="small"
      />
    );
  }

  return chips;
}
```

---

## Individual Filter Components

### Date Range Filter

```tsx
// apps/aviation-accident-tracker/frontend/src/components/DateRangeFilter.tsx

import React from 'react';
import { Box, Typography, TextField } from '@mui/material';

export interface DateRangeFilterProps {
  dateFrom?: string;
  dateTo?: string;
  onChange: (dateFrom?: string, dateTo?: string) => void;
}

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onChange
}: DateRangeFilterProps) {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Date Range
      </Typography>

      <Box display="flex" gap={1}>
        <TextField
          label="From"
          type="date"
          value={dateFrom || ''}
          onChange={(e) => onChange(e.target.value || undefined, dateTo)}
          InputLabelProps={{ shrink: true }}
          fullWidth
          size="small"
        />

        <TextField
          label="To"
          type="date"
          value={dateTo || ''}
          onChange={(e) => onChange(dateFrom, e.target.value || undefined)}
          InputLabelProps={{ shrink: true }}
          fullWidth
          size="small"
        />
      </Box>

      <Box mt={1}>
        <Button
          size="small"
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0];
            onChange(lastWeek, today);
          }}
        >
          Last 7 days
        </Button>
        <Button
          size="small"
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0];
            onChange(lastMonth, today);
          }}
        >
          Last 30 days
        </Button>
        <Button
          size="small"
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            const lastYear = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0];
            onChange(lastYear, today);
          }}
        >
          Last year
        </Button>
      </Box>
    </Box>
  );
}
```

### Category Filter

```tsx
// apps/aviation-accident-tracker/frontend/src/components/CategoryFilter.tsx

import React from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';

export interface CategoryFilterProps {
  selected: ('Commercial' | 'GA')[];
  onChange: (selected: ('Commercial' | 'GA')[]) => void;
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Category
      </Typography>

      <ToggleButtonGroup
        value={selected}
        onChange={(_, newValue) => onChange(newValue)}
        aria-label="category filter"
        size="small"
        fullWidth
      >
        <ToggleButton value="Commercial" aria-label="commercial">
          Commercial
        </ToggleButton>
        <ToggleButton value="GA" aria-label="general aviation">
          General Aviation
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
```

### Source Filter

```tsx
// apps/aviation-accident-tracker/frontend/src/components/SourceFilter.tsx

import React from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox
} from '@mui/material';

export interface SourceFilterProps {
  selected: ('ASN' | 'AVHerald')[];
  onChange: (selected: ('ASN' | 'AVHerald')[]) => void;
}

export function SourceFilter({ selected, onChange }: SourceFilterProps) {
  const handleToggle = (source: 'ASN' | 'AVHerald') => {
    const newSelected = selected.includes(source)
      ? selected.filter(s => s !== source)
      : [...selected, source];
    onChange(newSelected);
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Source
      </Typography>

      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={selected.includes('ASN')}
              onChange={() => handleToggle('ASN')}
            />
          }
          label="ASN Aviation Safety Network"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={selected.includes('AVHerald')}
              onChange={() => handleToggle('AVHerald')}
            />
          }
          label="AVHerald"
        />
      </FormGroup>
    </Box>
  );
}
```

### Fatalities Filter

```tsx
// apps/aviation-accident-tracker/frontend/src/components/FatalitiesFilter.tsx

import React from 'react';
import { Box, Typography, Slider, TextField } from '@mui/material';

export interface FatalitiesFilterProps {
  min?: number;
  max?: number;
  onChange: (min?: number, max?: number) => void;
}

export function FatalitiesFilter({ min, max, onChange }: FatalitiesFilterProps) {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Fatalities
      </Typography>

      <Box display="flex" gap={1} mb={1}>
        <TextField
          label="Min"
          type="number"
          value={min ?? ''}
          onChange={(e) => {
            const val = e.target.value ? parseInt(e.target.value) : undefined;
            onChange(val, max);
          }}
          size="small"
          inputProps={{ min: 0 }}
          sx={{ width: '80px' }}
        />

        <TextField
          label="Max"
          type="number"
          value={max ?? ''}
          onChange={(e) => {
            const val = e.target.value ? parseInt(e.target.value) : undefined;
            onChange(min, val);
          }}
          size="small"
          inputProps={{ min: 0 }}
          sx={{ width: '80px' }}
        />
      </Box>

      <Box mt={1}>
        <Button
          size="small"
          onClick={() => onChange(1, undefined)}
        >
          Fatal only
        </Button>
        <Button
          size="small"
          onClick={() => onChange(0, 0)}
        >
          Non-fatal only
        </Button>
      </Box>
    </Box>
  );
}
```

---

## Filter State Hook

```typescript
// apps/aviation-accident-tracker/frontend/src/hooks/useFilters.ts

import { useState, useCallback, useMemo } from 'react';
import type { Filters } from '../types/filters';

export interface UseFiltersResult {
  filters: Filters;
  hasActiveFilters: boolean;
  updateFilter: (updates: Partial<Filters>) => void;
  resetFilters: () => void;
  setFilters: (filters: Filters) => void;
}

export function useFilters(initialFilters: Partial<Filters> = {}): UseFiltersResult {
  const [filters, setFilters] = useState<Filters>({
    ...initialFilters
  });

  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).some(key => {
      const value = filters[key as keyof Filters];
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== '';
    });
  }, [filters]);

  const updateFilter = useCallback((updates: Partial<Filters>) => {
    setFilters(prev => {
      const next = { ...prev, ...updates };
      
      // Remove undefined/empty values
      Object.keys(next).forEach(key => {
        const value = next[key as keyof Filters];
        if (
          value === undefined ||
          value === '' ||
          (Array.isArray(value) && value.length === 0)
        ) {
          delete next[key as keyof Filters];
        }
      });
      
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    filters,
    hasActiveFilters,
    updateFilter,
    resetFilters,
    setFilters
  };
}
```

---

## Testing

```typescript
// apps/aviation-accident-tracker/frontend/src/components/Filters.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { Filters } from './Filters';

describe('Filters', () => {
  test('renders all filter sections', () => {
    render(<Filters onFiltersChange={() => {}} />);

    expect(screen.getByText('Date Range')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Fatalities')).toBeInTheDocument();
  });

  test('calls onFiltersChange when filter updated', () => {
    const handleChange = jest.fn();
    render(<Filters onFiltersChange={handleChange} />);

    const commercialButton = screen.getByRole('button', { name: /commercial/i });
    fireEvent.click(commercialButton);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ category: ['Commercial'] })
    );
  });

  test('shows active filters chips', () => {
    render(
      <Filters
        onFiltersChange={() => {}}
        initialFilters={{ category: ['Commercial'] }}
      />
    );

    expect(screen.getByText('Commercial')).toBeInTheDocument();
  });

  test('clears all filters', () => {
    const handleChange = jest.fn();
    render(
      <Filters
        onFiltersChange={handleChange}
        initialFilters={{ category: ['Commercial'] }}
      />
    );

    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith({});
  });
});
```

---

## Acceptance Criteria

- [ ] Date range filter works (from/to)
- [ ] Quick date buttons (last 7/30/365 days)
- [ ] Category filter toggles (Commercial/GA)
- [ ] Source filter checkboxes (ASN/AVHerald)
- [ ] Fatalities min/max inputs
- [ ] Text search filters (location, airport, aircraft)
- [ ] Active filters displayed as chips
- [ ] Individual chip deletion works
- [ ] Clear all button works
- [ ] Filter changes trigger parent update
- [ ] Responsive on mobile
- [ ] Tests passing (>70% coverage)

---

## Timeline

**Day 1:**
- Main Filters component
- Date range filter
- Category and source filters
- useFilters hook

**Day 2:**
- Fatalities filter
- Text search filters
- Active filters chips
- Tests and polish

---

**Status:** Ready for implementation
**Dependencies:** Frontend infrastructure, Event table
**Target Completion:** 2 days
