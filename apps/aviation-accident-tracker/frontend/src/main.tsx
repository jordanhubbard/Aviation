import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Aviation Accident Tracker (placeholder)</h1>
      <p>Map, filters, and table will render here.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
