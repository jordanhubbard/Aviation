# Aviation Meta App

> Part of the [Aviation Monorepo](../../README.md)

The **Meta App** provides a unified dashboard interface that aggregates all aviation applications into a single multi-tab web interface. It uses the `@aviation/ui-framework` package to provide seamless navigation between applications.

## Overview

The Meta App serves as a central hub for the Aviation Suite, allowing users to:
- Access all aviation applications from a single interface
- Switch between applications using a tabbed interface
- View application status and quick links
- Navigate applications with keyboard shortcuts

## Features

- **Multi-Tab Interface**: Tab-based navigation for all aviation apps
- **Responsive Design**: Works on desktop and mobile devices
- **Keyboard Navigation**: Arrow keys, Home, End for quick navigation
- **Modern UI**: Beautiful gradient design with smooth animations
- **Hot Module Replacement**: Fast development with Vite HMR

## Applications

The Meta App integrates these aviation applications:

1. **⚠️ Accident Tracker** - Track and visualize aviation accidents (port 8080)
2. **📋 Missions** - Mission management system (port 3000)
3. **🗺️ Flight Planner** - VFR flight planning (port 5001)
4. **🎓 Flight School** - Flight school management (port 5000)
5. **📊 ForeFlight** - Logbook analysis dashboard (port 3001)
6. **✈️ Tracker** - Real-time flight tracking (port 3002)
7. **🌤️ Weather** - Aviation weather briefing (port 3003)

## Quick Start

### Install Dependencies

```bash
cd apps/meta-app
make install
```

### Development Mode

```bash
make dev
```

The app will be available at `http://localhost:3100`

### Production Build

```bash
make build
```

## Project Structure

```
apps/meta-app/
├── src/
│   ├── App.tsx           # Main application component
│   ├── App.css           # Styling for the meta app
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── index.html            # HTML template
├── package.json          # Dependencies
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript config
├── beads.yaml            # Work organization
├── Makefile              # Build commands
└── README.md             # This file
```

## Architecture

### Multi-Tab Pattern

The Meta App uses the `@aviation/ui-framework` multi-tab components:

```typescript
import { TabNavigation, PaneContainer } from '@aviation/ui-framework';
import type { PaneConfig } from '@aviation/ui-framework';

const panes: PaneConfig[] = [
  {
    id: 'accident-tracker',
    title: 'Accident Tracker',
    icon: '⚠️',
    component: AccidentTrackerPane,
    order: 1,
  },
  // ... more panes
];
```

### Pane Components

Each application has a placeholder pane component that:
- Displays application name and description
- Provides a link to the standalone application
- Can be replaced with an embedded component in the future

## Customization

### Adding a New Application

1. Create a pane component:

```typescript
function MyNewAppPane() {
  return (
    <div className="pane-content">
      <h1>My New App</h1>
      <p>Description of the app</p>
      <a href="http://localhost:3004" target="_blank">
        Open My New App →
      </a>
    </div>
  );
}
```

2. Add to the panes configuration:

```typescript
const aviationPanes: PaneConfig[] = [
  // ... existing panes
  {
    id: 'my-new-app',
    title: 'My New App',
    icon: '🚁',
    component: MyNewAppPane,
    order: 8,
  },
];
```

### Embedding Applications

To fully embed an application (instead of linking to it):

1. Export a pane component from the application
2. Import it in the Meta App
3. Replace the placeholder component

Example:

```typescript
// In your app
export function MyAppPane() {
  return <div>Full embedded app UI</div>;
}

// In meta-app
import { MyAppPane } from '@aviation/my-app/ui';
```

## Keyboard Shortcuts

- **Arrow Left/Right**: Navigate between tabs
- **Home**: Jump to first tab
- **End**: Jump to last tab
- **Tab**: Focus navigation

## Development

### Hot Module Replacement

Vite provides instant HMR during development. Changes to components update immediately without full page reload.

### TypeScript

The Meta App is fully typed with TypeScript. Run type checking:

```bash
npm run build  # TypeScript compilation is part of build
```

## Deployment

### Docker

```bash
docker build -t aviation-meta-app .
docker run -p 3100:3100 aviation-meta-app
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3100 |

## Future Enhancements

- [ ] Embedded iframes for each application
- [ ] Application status indicators
- [ ] Recent applications list
- [ ] Favorites/pinned applications
- [ ] Search across all applications
- [ ] Notifications from applications
- [ ] Shared authentication state
- [ ] Dark/light theme toggle

## Tech Stack

- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **@aviation/ui-framework**: Multi-tab components
- **CSS**: Custom styling with gradients and animations

## Contributing

See [Aviation monorepo CONTRIBUTING.md](../../CONTRIBUTING.md) for general guidelines.

## License

MIT License — see [LICENSE](../../LICENSE)
