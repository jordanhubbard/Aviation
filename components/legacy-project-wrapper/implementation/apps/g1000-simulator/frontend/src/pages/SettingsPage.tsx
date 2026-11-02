import { ConfigPanel, getServicesByApp } from '@aviation/aviation-config';

export function SettingsPage() {
  return (
    <div className="settings-page">
      <h1>G1000 Simulator Settings</h1>
      <ConfigPanel
        services={getServicesByApp('g1000-simulator').map(service => service.id)}
        apiBase={import.meta.env.VITE_API_BASE_URL ?? ''}
        title="G1000 Simulator Configuration"
      />
    </div>
  );
}
