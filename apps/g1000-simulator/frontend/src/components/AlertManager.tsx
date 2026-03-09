// AlertManager.tsx
import React, { useState } from 'react';

interface Alert {
  id: string;
  level: 'warning' | 'caution' | 'advisory';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

const AlertManager: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const addAlert = (alert: Alert) => {
    setAlerts((prevAlerts) => {
      const newAlerts = [...prevAlerts, alert];
      newAlerts.sort((a, b) => a.level.localeCompare(b.level));
      return newAlerts.slice(0, 3);
    });
  };

  const acknowledgeAlert = (id: string) => {
    setAlerts((prevAlerts) =>
      prevAlerts.map((alert) =>
        alert.id === id ? { ...alert, acknowledged: true } : alert
      )
    );
  };

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
