// App.tsx
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import { SettingsPage } from './pages/SettingsPage';

const App: React.FC = () => {
  return (
    <Router>
      <Switch>
        <Route path="/settings" component={SettingsPage} />
        <Route path="/" component={Dashboard} />
      </Switch>
    </Router>
  );
};

export default App;
