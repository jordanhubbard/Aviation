---
id: Aviation-r2l
status: closed
deps: []
links: []
created: 2026-01-13T15:22:02.643933-08:00
type: task
priority: 0
mac-task-id: task_a7a2dda3278244429d2d0bcdd3cc2a20
---
# Extract map integration patterns to @aviation/ui-framework

**Epic Child: Aviation-sv9 - Shared Aviation Data Services**

Extract Leaflet/MapLibre integration patterns and utilities from flightplanner into shared UI framework.

**Current Implementation:**
- Location: `apps/flightplanner/frontend/src/components/LocalMap.tsx`
- Features:
  - Leaflet map initialization
  - Marker clustering
  - Route polylines
  - Custom markers and icons
  - Map event handling
  - Zoom controls
  - Layer management

**Target Location:**
- `packages/ui-framework/src/map/`
  - `MapProvider.tsx` - Map context provider
  - `LeafletMap.tsx` - Base Leaflet component
  - `Markers.tsx` - Marker components
  - `Polylines.tsx` - Route drawing
  - `Controls.tsx` - Map controls
  - `clustering.ts` - Marker clustering utilities

**Requirements:**
- [ ] Base map component (Leaflet/MapLibre)
- [ ] Marker component with clustering
- [ ] Polyline/route drawing
- [ ] Custom icon support
- [ ] Map controls (zoom, layers)
- [ ] Event handling (click, hover, drag)
- [ ] Responsive design
- [ ] TypeScript types
- [ ] React hooks for map state
- [ ] SSR compatibility
- [ ] Performance optimization (virtualization)
- [ ] Accessibility (keyboard navigation)

**Dependencies:**
- `leaflet` or `maplibre-gl`
- `react-leaflet` or `react-map-gl`
- `leaflet.markercluster`

**Acceptance Criteria:**
- [ ] Reusable map components exported
- [ ] All flightplanner map features supported
- [ ] Performance optimized (60fps)
- [ ] Responsive on mobile
- [ ] Accessibility compliant
- [ ] Unit tests for utilities
- [ ] Component tests (React Testing Library)
- [ ] Storybook examples
- [ ] Documentation

**Blocks:** accident-tracker map, flightplanner migration
