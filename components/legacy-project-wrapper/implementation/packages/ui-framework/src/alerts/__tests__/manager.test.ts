import { describe, expect, it, vi } from 'vitest';
import { AlertManager } from '../manager.js';
import { ALERT_PRIORITY } from '../types.js';

describe('AlertManager', () => {
  it('uses portable alert priorities while retaining timestamp tie policy', () => {
    vi.useFakeTimers();
    const manager = new AlertManager();

    vi.setSystemTime(new Date('2026-10-31T12:00:00Z'));
    const advisory = manager.addAlert({ level: 'advisory', message: 'Traffic available' });
    vi.setSystemTime(new Date('2026-10-31T12:00:01Z'));
    const caution = manager.addAlert({ level: 'caution', message: 'Fuel imbalance' });
    vi.setSystemTime(new Date('2026-10-31T12:00:02Z'));
    const warning = manager.addAlert({ level: 'warning', message: 'Terrain' });

    expect(ALERT_PRIORITY).toEqual({ warning: 3, caution: 2, advisory: 1 });
    expect(manager.getAlerts().map(({ id }) => id)).toEqual([
      warning.id,
      caution.id,
      advisory.id,
    ]);
    vi.useRealTimers();
  });

  it('owns acknowledgement, visibility, and clearing adapter behavior', () => {
    const manager = new AlertManager();
    const first = manager.addAlert({ level: 'warning', message: 'Warning' });
    manager.addAlert({ level: 'caution', message: 'Caution' });
    manager.addAlert({ level: 'advisory', message: 'Advisory' });
    manager.addAlert({ level: 'advisory', message: 'Second advisory' });

    expect(manager.getVisibleAlerts()).toHaveLength(3);
    expect(manager.acknowledgeAlert(first.id)).toBe(true);
    expect(manager.getAcknowledgedAlerts().map(({ id }) => id)).toEqual([first.id]);
    expect(manager.clearAcknowledgedAlerts()).toBe(1);
    expect(manager.getAlerts()).toHaveLength(3);
  });
});
