import { useState } from 'react';
import { TabNavigation, PaneContainer } from '@aviation/ui-framework';
import type { PaneConfig } from '@aviation/ui-framework';
import './App.css';

// Placeholder pane components for each aviation app
// These will be replaced with actual implementations from each app

function AccidentTrackerPane() {
  return (
    <div className="pane-content">
      <h1>Aviation Accident Tracker</h1>
      <p>Track and visualize aviation accidents/incidents with provenance and classification.</p>
      <a href="http://localhost:8080" target="_blank" rel="noopener noreferrer">
        Open Accident Tracker →
      </a>
    </div>
  );
}

function MissionsAppPane() {
  return (
    <div className="pane-content">
      <h1>Aviation Missions</h1>
      <p>Mission management and tracking system.</p>
      <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">
        Open Missions App →
      </a>
    </div>
  );
}

function FlightPlannerPane() {
  return (
    <div className="pane-content">
      <h1>Flight Planner</h1>
      <p>VFR flight planning with terrain analysis and weather integration.</p>
      <a href="http://localhost:5001" target="_blank" rel="noopener noreferrer">
        Open Flight Planner →
      </a>
    </div>
  );
}

function FlightSchoolPane() {
  return (
    <div className="pane-content">
      <h1>Flight School</h1>
      <p>Flight school management with booking and scheduling.</p>
      <a href="http://localhost:5000" target="_blank" rel="noopener noreferrer">
        Open Flight School →
      </a>
    </div>
  );
}

function ForeFlightDashboardPane() {
  return (
    <div className="pane-content">
      <h1>ForeFlight Dashboard</h1>
      <p>Logbook analysis and statistics dashboard.</p>
      <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer">
        Open ForeFlight Dashboard →
      </a>
    </div>
  );
}

function FlightTrackerPane() {
  return (
    <div className="pane-content">
      <h1>Flight Tracker</h1>
      <p>Real-time flight tracking service.</p>
      <a href="http://localhost:3002" target="_blank" rel="noopener noreferrer">
        Open Flight Tracker →
      </a>
    </div>
  );
}

function WeatherBriefingPane() {
  return (
    <div className="pane-content">
      <h1>Weather Briefing</h1>
      <p>Aviation weather briefing service.</p>
      <a href="http://localhost:3003" target="_blank" rel="noopener noreferrer">
        Open Weather Briefing →
      </a>
    </div>
  );
}

// Define all aviation app panes
const aviationPanes: PaneConfig[] = [
  {
    id: 'accident-tracker',
    title: 'Accident Tracker',
    icon: '⚠️',
    component: AccidentTrackerPane,
    order: 1,
    defaultOpen: true,
  },
  {
    id: 'missions',
    title: 'Missions',
    icon: '📋',
    component: MissionsAppPane,
    order: 2,
  },
  {
    id: 'flight-planner',
    title: 'Flight Planner',
    icon: '🗺️',
    component: FlightPlannerPane,
    order: 3,
  },
  {
    id: 'flight-school',
    title: 'Flight School',
    icon: '🎓',
    component: FlightSchoolPane,
    order: 4,
  },
  {
    id: 'foreflight',
    title: 'ForeFlight',
    icon: '📊',
    component: ForeFlightDashboardPane,
    order: 5,
  },
  {
    id: 'tracker',
    title: 'Tracker',
    icon: '✈️',
    component: FlightTrackerPane,
    order: 6,
  },
  {
    id: 'weather',
    title: 'Weather',
    icon: '🌤️',
    component: WeatherBriefingPane,
    order: 7,
  },
];

function App() {
  const [activeId, setActiveId] = useState<string>('accident-tracker');

  const activePane = aviationPanes.find((p) => p.id === activeId) || null;

  return (
    <div className="meta-app">
      <header className="meta-app-header">
        <h1 className="meta-app-title">🛩️ Aviation Suite</h1>
        <p className="meta-app-subtitle">Unified aviation application dashboard</p>
      </header>

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

      <footer className="meta-app-footer">
        <p>Aviation Monorepo Meta App • {aviationPanes.length} Applications</p>
      </footer>
    </div>
  );
}

export default App;
