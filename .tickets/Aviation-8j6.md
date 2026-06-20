---
id: Aviation-8j6
status: closed
deps: []
links: []
created: 2026-01-17T22:42:52.104969-08:00
type: feature
priority: 1
mac-task-id: task_eff566b08e314393a4e77ad532e45f10
---
# Improve weather briefing layout: map below selector, METAR below map

## Feature Request: Reorganize Weather Briefing Layout

**Application:** weather-briefing  
**Priority:** P1 - High (UX Improvement)  
**Environment:** Production (weather-briefing-production.up.railway.app)

### Current Layout Issue

The weather briefing application currently has an inconsistent or suboptimal layout where the components are not in the most logical order for pilot workflow.

### Proposed Layout Structure

Reorganize the page to follow a logical top-to-bottom flow:

```
┌─────────────────────────────────────────┐
│  Airport Selector                       │
│  [KORD - Chicago O'Hare    ▼]  [KORD]  │
│  [Get Briefing]                         │
├─────────────────────────────────────────┤
│  Global Weather Map                     │
│  (Interactive map with weather layers)  │
│                                         │
│  Zoom and pan to explore conditions     │
├─────────────────────────────────────────┤
│  AVIATION WEATHER BRIEFING              │
│                                         │
│  Location: Chicago O'Hare (KORD)       │
│  Time: 2026-01-18...                   │
│                                         │
│  CURRENT CONDITIONS                     │
│  Raw METAR: METAR KORD...              │
│                                         │
│  PARSED CONDITIONS                      │
│  Wind: 240° at 10 kt gusting 17 kt    │
│  Visibility: 7 SM                      │
│  Ceiling: 4800 ft AGL                  │
│  Temperature: 14°F                     │
│                                         │
│  FLIGHT CATEGORY: VFR                  │
│  RECOMMENDATION: VFR conditions...     │
└─────────────────────────────────────────┘
```

### User Workflow Rationale

**1. Airport Selector (Top)**
- First action: pilot selects airport
- Small, focused interaction
- Always visible without scrolling

**2. Weather Map (Middle)**
- Visual overview of regional weather
- Context for the selected airport
- Interactive exploration of surrounding conditions
- Helps pilots understand big picture before diving into details

**3. Decoded METAR (Bottom)**
- Detailed text information
- Natural scroll down for more detail
- Can be lengthy, so placing at bottom doesn't push map down
- Follows the pattern: select → visualize → read details

### Current Problems

1. **Map placement inconsistent** - May appear after text briefing, making it easy to miss
2. **Text-heavy top** - Decoded METAR at top pushes map far down
3. **Poor mobile UX** - Long text briefing means map is off-screen
4. **Workflow disruption** - Pilots want to see map quickly after selecting airport

### Technical Implementation

#### Component Structure (React/TypeScript)

```tsx
// apps/weather-briefing/src/components/WeatherBriefing.tsx

export function WeatherBriefingPage() {
  return (
    <div className="weather-briefing-page">
      {/* Section 1: Airport Selection */}
      <section className="airport-selector-section">
        <h2>Airport Selection</h2>
        <AirportSelector 
          value={selectedAirport}
          onChange={setSelectedAirport}
        />
        <button onClick={getBriefing}>Get Briefing</button>
      </section>

      {/* Section 2: Weather Map */}
      {briefingData && (
        <section className="weather-map-section">
          <h2>Global Weather Map</h2>
          <p className="map-description">
            Zoom and pan to explore current conditions by region.
          </p>
          <WeatherMap 
            region={region}
            selectedAirport={selectedAirport}
            center={briefingData.coordinates}
          />
        </section>
      )}

      {/* Section 3: Text Briefing */}
      {briefingData && (
        <section className="text-briefing-section">
          <h2>Aviation Weather Briefing</h2>
          
          <div className="briefing-header">
            <p>Location: {briefingData.location}</p>
            <p>Time: {briefingData.time}</p>
          </div>

          <div className="current-conditions">
            <h3>Current Conditions</h3>
            <pre className="raw-metar">{briefingData.rawMetar}</pre>
          </div>

          <div className="parsed-conditions">
            <h3>Parsed Conditions</h3>
            <ul>
              <li>Wind: {briefingData.wind}</li>
              <li>Visibility: {briefingData.visibility}</li>
              <li>Ceiling: {briefingData.ceiling}</li>
              <li>Temperature: {briefingData.temperature}</li>
            </ul>
          </div>

          <div className="flight-category">
            <h3>Flight Category</h3>
            <p className="category-badge">{briefingData.category}</p>
          </div>

          <div className="recommendation">
            <h3>Recommendation</h3>
            <p>{briefingData.recommendation}</p>
          </div>
        </section>
      )}
    </div>
  );
}
```

#### CSS/Styling

```css
.weather-briefing-page {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

/* Airport Selector - Sticky at top */
.airport-selector-section {
  position: sticky;
  top: 0;
  background: var(--bg-primary);
  z-index: 100;
  padding: 1rem;
  border-bottom: 2px solid var(--border-color);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Weather Map - Prominent middle section */
.weather-map-section {
  min-height: 500px;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1.5rem;
}

.map-description {
  color: var(--text-muted);
  margin-bottom: 1rem;
}

/* Text Briefing - Scrollable detail section */
.text-briefing-section {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 2rem;
}

.raw-metar {
  background: var(--bg-code);
  padding: 1rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  overflow-x: auto;
  white-space: pre-wrap;
}

.parsed-conditions ul {
  list-style: none;
  padding: 0;
}

.parsed-conditions li {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.category-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: bold;
}

.category-badge.VFR {
  background: #22c55e;
  color: white;
}

.category-badge.MVFR {
  background: #3b82f6;
  color: white;
}

.category-badge.IFR {
  background: #ef4444;
  color: white;
}

/* Responsive design */
@media (max-width: 768px) {
  .weather-map-section {
    min-height: 300px;
  }
  
  .airport-selector-section {
    position: static; /* Don't stick on mobile */
  }
}
```

### Mobile Considerations

On mobile devices:
- Airport selector at top (not sticky to save space)
- Map scales to viewport width
- Text briefing sections stack vertically
- All sections remain in the same order

### Accessibility

- Clear heading hierarchy (h2 for sections, h3 for subsections)
- Logical tab order follows visual order
- Map has keyboard navigation
- ARIA labels for interactive elements

### User Benefits

1. **Faster decision-making** - Visual map appears immediately after selection
2. **Better context** - See regional weather before reading text
3. **Reduced scrolling** - Map visible without scrolling past text
4. **Improved workflow** - Matches pilot's mental model (select → visualize → detail)
5. **Mobile-friendly** - Key info visible in viewport

### Comparison: Before vs After

**Before (Current):**
```
1. Airport Selector
2. Text Briefing (long)
3. Map (requires scrolling)
```

**After (Proposed):**
```
1. Airport Selector
2. Map (immediately visible)
3. Text Briefing (detail on demand)
```

### Testing Checklist

- [ ] Airport selector stays at top
- [ ] Map appears immediately below selector (no text in between)
- [ ] METAR decoded information appears below map
- [ ] Layout works on desktop (1920x1080)
- [ ] Layout works on tablet (768x1024)
- [ ] Layout works on mobile (375x667)
- [ ] Scroll behavior is smooth
- [ ] All sections maintain hierarchy on different screen sizes
- [ ] No layout shift when briefing loads
- [ ] Map loads progressively (doesn't block page render)

### Alternative Layouts Considered

**Option A: Side-by-side (Desktop)**
- Map on left, text on right
- Rejected: Difficult on mobile, splits attention

**Option B: Tabs**
- Separate tabs for map and text
- Rejected: Requires extra clicks, hides information

**Option C: Proposed (Vertical stack)** ✅ SELECTED
- Best for all screen sizes
- Natural top-to-bottom flow
- Progressive disclosure

### Acceptance Criteria

- [ ] Airport selector appears at top of page
- [ ] Weather map appears directly below airport selector
- [ ] No text content between selector and map
- [ ] Decoded METAR appears below map
- [ ] Layout is consistent across all screen sizes
- [ ] Map is fully visible without scrolling (on desktop)
- [ ] Order is maintained: Selector → Map → Text
- [ ] Existing functionality (briefing generation) still works
- [ ] Visual design matches application theme

### Priority Justification

**P1 (High)** because:
- Significantly improves user experience
- Aligns with pilot workflow and mental model
- Improves mobile usability (many pilots use tablets/phones)
- Quick win with high user impact
- Not P0 because current app is functional, just suboptimal layout

### Related Issues

- Could integrate with map improvements (layers, overlays)
- Could add map bookmarking/favorites
- Could show route planning on map in future

## Close Reason

Reordered weather briefing layout with sticky selector, prominent map, and briefing below map
