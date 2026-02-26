// alertStore.ts
import { create } from 'zustand';

export interface Alert {
  id: string;
  level: 'warning' | 'caution' | 'advisory';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface AlertStore {
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => void;
  acknowledgeAlert: (id: string) => void;
  clearAlert: (id: string) => void;
  clearAllAlerts: () => void;
}

const PRIORITY_ORDER = {
  warning: 0,
  caution: 1,
  advisory: 2,
};

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],

  addAlert: (alert) =>
    set((state) => {
      const newAlert: Alert = {
        ...alert,
        id: `alert-${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        acknowledged: false,
      };

      // Add alert and sort by priority (warning > caution > advisory)
      const updatedAlerts = [...state.alerts, newAlert].sort(
        (a, b) => PRIORITY_ORDER[a.level] - PRIORITY_ORDER[b.level]
      );

      // Keep only top 3 alerts
      return { alerts: updatedAlerts.slice(0, 3) };
    }),

  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === id ? { ...alert, acknowledged: true } : alert
      ),
    })),

  clearAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((alert) => alert.id !== id),
    })),

  clearAllAlerts: () => set({ alerts: [] }),
}));
