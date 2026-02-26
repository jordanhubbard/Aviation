// alertStore.ts
// Alert state management using Zustand

import { create } from 'zustand';

export enum AlertLevel {
  MASTER_WARNING = 'MASTER_WARNING',
  MASTER_CAUTION = 'MASTER_CAUTION',
  ADVISORY = 'ADVISORY',
}

export interface Alert {
  id: string;
  level: AlertLevel;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

interface AlertStore {
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => void;
  removeAlert: (id: string) => void;
  acknowledgeAlert: (id: string) => void;
  clearAllAlerts: () => void;
  getActiveAlerts: () => Alert[];
  getAlertsByLevel: (level: AlertLevel) => Alert[];
}

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [],

  addAlert: (alert) =>
    set((state) => ({
      alerts: [
        ...state.alerts,
        {
          ...alert,
          id: `alert-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          acknowledged: false,
        },
      ],
    })),

  removeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((alert) => alert.id !== id),
    })),

  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === id ? { ...alert, acknowledged: true } : alert
      ),
    })),

  clearAllAlerts: () => set({ alerts: [] }),

  getActiveAlerts: () => {
    const state = get();
    return state.alerts.filter((alert) => !alert.acknowledged);
  },

  getAlertsByLevel: (level) => {
    const state = get();
    return state.alerts.filter((alert) => alert.level === level);
  },
}));
