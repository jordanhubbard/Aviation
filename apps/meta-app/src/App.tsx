import { useState } from 'react';
import { TabNavigation, PaneContainer } from '@aviation/ui-framework';
import type { PaneConfig } from '@aviation/ui-framework';
import './App.css';

type AppLink = {
  id: string;
  title: string;
  tabTitle: string;
  description: string;
  icon: string;
  localUrl: string;
  productionUrl: string;
  envUrl?: string;
};

type ResolvedAppLink = AppLink & { url: string };

const metaAppMode = import.meta.env.VITE_META_APP_MODE ?? 'tabs';
const isLauncher = metaAppMode === 'launcher';

const appLinks: AppLink[] = [
  {
    id: 'accident-tracker',
    title: 'Aviation Accident Tracker',
    tabTitle: 'Accident Tracker',
    description: 'Track and visualize aviation accidents with provenance and classification.',
    icon: '⚠️',
    localUrl: 'http://localhost:8080',
    productionUrl: 'https://aviation-accidents-production.up.railway.app/',
    envUrl: import.meta.env.VITE_ACCIDENT_TRACKER_URL,
  },
  {
    id: 'missions',
    title: 'Aviation Missions',
    tabTitle: 'Missions',
    description: 'Mission management and tracking system.',
    icon: '📋',
    localUrl: 'http://localhost:3000',
    productionUrl: 'https://aviation-missions-production.up.railway.app/',
    envUrl: import.meta.env.VITE_MISSIONS_URL,
  },
  {
    id: 'flight-planner',
    title: 'Flight Planner',
    tabTitle: 'Flight Planner',
    description: 'VFR flight planning with terrain analysis and weather integration.',
    icon: '🗺️',
    localUrl: 'http://localhost:5001',
    productionUrl: 'https://flight-planner-production.up.railway.app/',
    envUrl: import.meta.env.VITE_FLIGHT_PLANNER_URL,
  },
  {
    id: 'flight-school',
    title: 'Flight School',
    tabTitle: 'Flight School',
    description: 'Flight school management with booking and scheduling.',
    icon: '🎓',
    localUrl: 'http://localhost:5000',
    productionUrl: 'https://flightschool-production.up.railway.app/',
    envUrl: import.meta.env.VITE_FLIGHT_SCHOOL_URL,
  },
  {
    id: 'foreflight',
    title: 'ForeFlight Dashboard',
    tabTitle: 'ForeFlight',
    description: 'Logbook analysis and statistics dashboard.',
    icon: '📊',
    localUrl: 'http://localhost:3001',
    productionUrl: 'https://foreflight-dashboard-production.up.railway.app/',
    envUrl: import.meta.env.VITE_FOREFLIGHT_URL,
  },
  {
    id: 'tracker',
    title: 'Flight Tracker',
    tabTitle: 'Tracker',
    description: 'Real-time flight tracking service.',
    icon: '✈️',
    localUrl: 'http://localhost:3002',
    productionUrl: 'https://flight-tracker-production-384f.up.railway.app/',
    envUrl: import.meta.env.VITE_FLIGHT_TRACKER_URL,
  },
  {
    id: 'weather',
    title: 'Weather Briefing',
    tabTitle: 'Weather',
    description: 'Aviation weather briefing service.',
    icon: '🌤️',
    localUrl: 'http://localhost:3003',
    productionUrl: 'https://weather-briefing-production.up.railway.app/',
    envUrl: import.meta.env.VITE_WEATHER_BRIEFING_URL,
  },
];

const resolvedApps: ResolvedAppLink[] = appLinks.map((app) => ({
  ...app,
  url: app.envUrl || (isLauncher ? app.productionUrl : app.localUrl),
}));

const aviationPanes: PaneConfig[] = resolvedApps.map((app, index) => ({
  id: app.id,
  title: app.tabTitle,
  icon: app.icon,
  component: () => <AppPane app={app} />,
  order: index + 1,
  defaultOpen: index === 0,
}));

function AppPane({ app }: { app: ResolvedAppLink }) {
  return (
    <div className="pane-content">
      <h1>{app.title}</h1>
      <p>{app.description}</p>
      <a href={app.url} target="_blank" rel="noopener noreferrer">
        Open {app.tabTitle} →
      </a>
    </div>
  );
}

function App() {
  const [activeId, setActiveId] = useState<string>(resolvedApps[0]?.id ?? '');

  const activePane = aviationPanes.find((p) => p.id === activeId) || null;
  const subtitle = isLauncher
    ? 'Launch aviation apps on demand'
    : 'Unified aviation application dashboard';

  return (
    <div className="meta-app">
      <header className="meta-app-header">
        <h1 className="meta-app-title">🛩️ Aviation Suite</h1>
        <p className="meta-app-subtitle">{subtitle}</p>
      </header>

      {isLauncher ? (
        <main className="meta-app-main">
          <div className="launcher-grid">
            {resolvedApps.map((app) => (
              <a
                key={app.id}
                className="launcher-card"
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="launcher-card-header">
                  <span className="launcher-card-icon">{app.icon}</span>
                  <h2 className="launcher-card-title">{app.title}</h2>
                </div>
                <p className="launcher-card-description">{app.description}</p>
                <span className="launcher-card-cta">Open {app.tabTitle} →</span>
              </a>
            ))}
          </div>
        </main>
      ) : (
        <>
          <TabNavigation
            panes={aviationPanes}
            activeId={activeId}
            onTabSelect={setActiveId}
            className="meta-app-tabs"
          />

          <main className="meta-app-main">
            <PaneContainer
              activePane={activePane}
              className="meta-app-pane"
              emptyState={
                <div className="meta-app-empty">
                  <p>No application selected</p>
                </div>
              }
            />
          </main>
        </>
      )}

      <footer className="meta-app-footer">
        <p>Aviation Monorepo Meta App • {resolvedApps.length} Applications</p>
      </footer>
    </div>
  );
}

export default App;
