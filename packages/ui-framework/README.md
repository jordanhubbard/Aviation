# @aviation/ui-framework

UI framework supporting multiple modalities for aviation applications.

## Features
- Multi-Tab Web UI container
- Mobile and standalone UI bases
- Map helper utilities (marker normalization, cluster defaults)

## Installation
```bash
npm install @aviation/ui-framework
```

## Usage
### Multi-Tab Web UI
```typescript
import { MultiTabWebUI } from '@aviation/ui-framework';

const webUI = new MultiTabWebUI();
webUI.registerPane({ id: 'flight-tracker', title: 'Flight Tracker', component: FlightTrackerComponent, order: 1 });
webUI.registerPane({ id: 'weather', title: 'Weather', component: WeatherComponent, order: 2 });
webUI.switchPane('weather');
const activePane = webUI.getActivePane();
```

### Map helpers
```typescript
import { normalizeMarkers, defaultClusterOptions } from '@aviation/ui-framework';

const markers = normalizeMarkers([
  { id: 'evt-1', lat: 37.6, lon: -122.3, title: 'KSFO', subtitle: 'Incident', category: 'general', onClickId: 'evt-1' },
]);
const clusterOpts = defaultClusterOptions({ disableClusteringAtZoom: 10 });
```
Use these with your Leaflet/Mapbox layer to keep payloads normalized and clustering consistent.

### Mobile / Standalone bases
```typescript
import { MobileUI, StandaloneWebUI } from '@aviation/ui-framework';
```
(Extend and implement `render()` as needed.)

## API Reference
- `MultiTabWebUI`: registerPane, unregisterPane, switchPane, getActivePane, getAllPanes
- `normalizeMarkers(inputs)`: convert lat/lon + metadata into normalized markers
- `defaultClusterOptions(overrides)`: sensible clustering defaults
- `MobileUI`, `StandaloneWebUI`: base classes

## License
MIT
