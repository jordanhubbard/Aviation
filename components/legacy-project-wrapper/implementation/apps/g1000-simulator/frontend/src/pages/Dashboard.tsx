// Dashboard.tsx
import React, { useEffect } from 'react';
import { registerDecisionContext } from '@aviation/ai-explainer/browser';
import AlertManager from '../components/AlertManager';
import { useAlertStore } from '../stores/alertStore';

const Dashboard: React.FC = () => {
  const { addAlert } = useAlertStore();
  useEffect(() => registerDecisionContext(() => ({
    application: 'G1000 Simulator',
    decision: 'Alert priority and acknowledgement on the simulator dashboard',
    alerts: useAlertStore.getState().alerts.map(({ level, message, acknowledged }) =>
      ({ level, message, acknowledged })),
  }), 'Why are these simulator alerts shown in this order?'), []);

  const handleAddAlert = () => {
    addAlert({
      level: 'warning',
      message: 'This is a test alert',
    });
  };

  return (
    <div>
      <h1>G1000 Simulator Dashboard</h1>
      <button onClick={handleAddAlert}>Add Test Alert</button>
      <AlertManager />
    </div>
  );
};

export default Dashboard;
