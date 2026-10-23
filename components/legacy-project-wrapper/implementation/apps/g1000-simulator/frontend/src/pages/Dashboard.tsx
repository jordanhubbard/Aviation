// Dashboard.tsx
import React from 'react';
import AlertManager from '../components/AlertManager';
import { useAlertStore } from '../stores/alertStore';

const Dashboard: React.FC = () => {
  const { addAlert } = useAlertStore();

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
