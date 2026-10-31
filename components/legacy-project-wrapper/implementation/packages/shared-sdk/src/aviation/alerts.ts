/** Provider-neutral aviation alert lifecycle semantics. */

export type CanonicalAlertLevel = 'normal' | 'advisory' | 'caution' | 'warning';
export type AlertLevelInput = CanonicalAlertLevel | 'ok' | 'debug' | 'info' | 'critical';

export interface AlertLifecycleRecord {
  id: string;
  level: AlertLevelInput | string;
  acknowledged: boolean;
}

/** Stable fail-closed error emitted by portable alert operations. */
export class AlertLifecycleError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AlertLifecycleError';
  }
}

const LEVEL_ALIASES: Readonly<Record<string, CanonicalAlertLevel>> = {
  normal: 'normal',
  ok: 'normal',
  debug: 'normal',
  advisory: 'advisory',
  info: 'advisory',
  caution: 'caution',
  warning: 'warning',
  critical: 'warning',
};

const LEVEL_PRIORITY: Readonly<Record<CanonicalAlertLevel, number>> = {
  normal: 0,
  advisory: 1,
  caution: 2,
  warning: 3,
};

/** Normalize a canonical level or supported application alias. */
export function normalizeAlertLevel(level: unknown): CanonicalAlertLevel {
  const input = typeof level === 'string' ? level.trim().toLowerCase() : '';
  const normalized = LEVEL_ALIASES[input];
  if (!normalized) {
    throw new AlertLifecycleError(
      'alert-level-invalid',
      `unsupported alert level: ${String(level)}`,
    );
  }
  return normalized;
}

/** Return the portable ascending priority for a level. */
export function alertPriority(level: unknown): number {
  return LEVEL_PRIORITY[normalizeAlertLevel(level)];
}

/**
 * Return a stable lifecycle-ordered copy without mutating records or the input list.
 */
export function orderAlerts<T extends AlertLifecycleRecord>(alerts: readonly T[]): T[] {
  return alerts
    .map((alert, index) => ({ alert, index, priority: alertPriority(alert.level) }))
    .sort((left, right) => {
      if (left.alert.acknowledged !== right.alert.acknowledged) {
        return left.alert.acknowledged ? 1 : -1;
      }
      const priorityDelta = right.priority - left.priority;
      return priorityDelta !== 0 ? priorityDelta : left.index - right.index;
    })
    .map(({ alert }) => alert);
}

/** Retain active acknowledgements once, in their first-occurrence order. */
export function reconcileAcknowledgements(
  activeIds: readonly string[],
  acknowledgedIds: readonly string[],
): string[] {
  const active = new Set(activeIds);
  const retained = new Set<string>();
  for (const id of acknowledgedIds) {
    if (active.has(id)) retained.add(id);
  }
  return [...retained];
}

/** Return the highest canonical severity in scope, or normal for an empty scope. */
export function highestAlertLevel(
  alerts: readonly AlertLifecycleRecord[],
  includeAcknowledged = false,
): CanonicalAlertLevel {
  let highest: CanonicalAlertLevel = 'normal';
  let highestPriority = LEVEL_PRIORITY.normal;
  for (const alert of alerts) {
    const level = normalizeAlertLevel(alert.level);
    if (!includeAcknowledged && alert.acknowledged) continue;
    const priority = LEVEL_PRIORITY[level];
    if (priority > highestPriority) {
      highest = level;
      highestPriority = priority;
    }
  }
  return highest;
}
