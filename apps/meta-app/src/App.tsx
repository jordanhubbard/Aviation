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
  sourceUrl: string;
};

type ResolvedAppLink = AppLink & { url: string };

const metaAppMode = import.meta.env.VITE_META_APP_MODE ?? 'tabs';
const isLauncher = metaAppMode === 'launcher';
const repoBaseUrl = 'https://github.com/jordanhubbard/Aviation/tree/main/apps';

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
    sourceUrl: `${repoBaseUrl}/aviation-accident-tracker`,
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
    sourceUrl: `${repoBaseUrl}/aviation-missions-app`,
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
    sourceUrl: `${repoBaseUrl}/flight-planner`,
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
    sourceUrl: `${repoBaseUrl}/flightschool`,
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
    sourceUrl: `${repoBaseUrl}/foreflight-dashboard`,
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
    sourceUrl: `${repoBaseUrl}/flight-tracker`,
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
    sourceUrl: `${repoBaseUrl}/weather-briefing`,
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
      <div className="pane-links">
        <a className="pane-link" href={app.url} target="_blank" rel="noopener noreferrer">
          Open {app.tabTitle} →
        </a>
        <a className="pane-link pane-link-secondary" href={app.sourceUrl} target="_blank" rel="noopener noreferrer">
          View source
        </a>
      </div>
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
              <div
                key={app.id}
                className="launcher-card"
              >
                <div className="launcher-card-header">
                  <span className="launcher-card-icon">{app.icon}</span>
                  <h2 className="launcher-card-title">{app.title}</h2>
                </div>
                <p className="launcher-card-description">{app.description}</p>
                <div className="launcher-card-actions">
                  <a
                    className="launcher-card-cta"
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open {app.tabTitle} →
                  </a>
                  <a
                    className="launcher-card-source"
                    href={app.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Source
                  </a>
                </div>
              </div>
            ))}
          </div>
        </main>
      ) : (
        <>
          <TabNavigation
            panes={aviationPanes}
            activeId={activeId}
            onTabSelect={setActiveId}
            useDefaultStyles={false}
            className="meta-app-tabs"
          />

          <main className="meta-app-main">
            <PaneContainer
              activePane={activePane}
              className="meta-app-pane"
              useDefaultStyles={false}
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
