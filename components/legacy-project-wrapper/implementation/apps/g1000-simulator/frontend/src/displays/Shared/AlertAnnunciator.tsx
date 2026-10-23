// AlertAnnunciator.tsx

import React from 'react';

// Define alert levels
const AlertLevels = {
  MASTER_WARNING: 'red',
  MASTER_CAUTION: 'yellow',
  ADVISORY: 'cyan',
};

// AlertAnnunciator component
const AlertAnnunciator = ({ alerts }) => {
  return (
    <div className="alert-annunciator">
      {alerts.map((alert, index) => (
        <div
          key={index}
          className="alert"
          style={{ backgroundColor: AlertLevels[alert.level] }}
        >
          {alert.message}
        </div>
      ))}
    </div>
  );
};

export default AlertAnnunciator;
