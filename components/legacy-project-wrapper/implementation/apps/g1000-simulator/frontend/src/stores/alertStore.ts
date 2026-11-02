// alertStore.ts
import { create } from 'zustand'
import { orderAlerts } from '@aviation/shared-sdk/aviation/alerts'

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

      const updatedAlerts = orderAlerts([...state.alerts, newAlert]);

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
