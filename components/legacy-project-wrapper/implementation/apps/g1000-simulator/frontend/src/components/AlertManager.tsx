// AlertManager.tsx
import React from 'react';
import { useAlertStore } from '../stores/alertStore';

const AlertManager: React.FC = () => {
  const { alerts, acknowledgeAlert } = useAlertStore();

  return (
    <div>
      {alerts.map((alert) => (
        <div key={alert.id} style={{ opacity: alert.acknowledged ? 0.5 : 1 }}>
          <strong>{alert.level.toUpperCase()}</strong>: {alert.message}
          <button onClick={() => acknowledgeAlert(alert.id)}>Acknowledge</button>
        </div>
      ))}
    </div>
  );
};

export default AlertManager;
