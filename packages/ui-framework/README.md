# @aviation/ui-framework

UI framework supporting multiple modalities for aviation applications.

## Features

- **Multi-Tab Web UI**: Single web application with multiple panes
- **Mobile UI**: Self-contained mobile applications
- **Standalone Web UI**: Individual web applications

## Installation

```bash
npm install @aviation/ui-framework
```

## Usage

### Multi-Tab Web UI

Create a multi-tab interface with multiple application panes:

```typescript
import { MultiTabWebUI, ApplicationPane } from '@aviation/ui-framework';

const webUI = new MultiTabWebUI();

// Register application panes
webUI.registerPane({
  id: 'flight-tracker',
  title: 'Flight Tracker',
  icon: '✈️',
  component: FlightTrackerComponent,
  order: 1
});

webUI.registerPane({
  id: 'weather',
  title: 'Weather',
  icon: '🌤️',
  component: WeatherComponent,
  order: 2
});

// Switch between panes
webUI.switchPane('weather');

// Get active pane
const activePane = webUI.getActivePane();
console.log(`Active pane: ${activePane.title}`);

// Get all panes (ordered)
const allPanes = webUI.getAllPanes();
```

### Mobile UI

Create a mobile application:

```typescript
import { MobileUI } from '@aviation/ui-framework';

class MyMobileApp extends MobileUI {
  constructor() {
    super('my-app', 'My Aviation App');
  }

  render(): void {
    // Render mobile UI
    console.log(`Rendering mobile UI for ${this.name}`);
  }
}

const mobileApp = new MyMobileApp();
mobileApp.render();
```

### Standalone Web UI

Create a standalone web application:

```typescript
import { StandaloneWebUI } from '@aviation/ui-framework';

class MyWebApp extends StandaloneWebUI {
  constructor() {
    super('my-app', 'My Aviation App');
  }

  render(): void {
    // Render standalone web UI
    console.log(`Rendering web UI for ${this.name}`);
  }
}

const webApp = new MyWebApp();
webApp.render();
```

## API Reference

### MultiTabWebUI

Container for multi-tab web interfaces.

**Methods:**
- `registerPane(pane)`: Register an application pane
- `unregisterPane(paneId)`: Remove an application pane
- `switchPane(paneId)`: Switch to a different pane
- `getActivePane()`: Get the currently active pane
- `getAllPanes()`: Get all registered panes (sorted by order)

### ApplicationPane Interface

Configuration for application panes.

**Properties:**
- `id`: Unique identifier
- `title`: Display title
- `icon`: Optional icon
- `component`: Component reference
- `order`: Optional display order

### MobileUI

Base class for mobile applications.

**Properties:**
- `id`: Application identifier
- `name`: Application name
- `modality`: Always 'mobile'

**Methods:**
- `render()`: Render the mobile UI (abstract, must implement)

### StandaloneWebUI

Base class for standalone web applications.

**Properties:**
- `id`: Application identifier
- `name`: Application name
- `modality`: Always 'standalone'

**Methods:**
- `render()`: Render the web UI (abstract, must implement)

## License

MIT
