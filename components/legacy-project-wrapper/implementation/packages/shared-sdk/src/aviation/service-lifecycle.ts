/** Provider-neutral background-service lifecycle transitions. */

export type ServiceLifecycleState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'failed';

export type ServiceLifecycleEvent =
  | 'start_requested'
  | 'start_succeeded'
  | 'start_failed'
  | 'stop_requested'
  | 'stop_succeeded'
  | 'stop_failed'
  | 'reset';

/** Stable fail-closed error emitted for an invalid lifecycle transition. */
export class ServiceLifecycleError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ServiceLifecycleError';
  }
}

const TRANSITIONS: Readonly<
  Partial<Record<ServiceLifecycleState, Partial<Record<ServiceLifecycleEvent, ServiceLifecycleState>>>>
> = {
  stopped: { start_requested: 'starting' },
  starting: { start_succeeded: 'running', start_failed: 'failed' },
  running: { stop_requested: 'stopping' },
  stopping: { stop_succeeded: 'stopped', stop_failed: 'failed' },
  failed: { reset: 'stopped' },
};

/** Return the next lifecycle state, rejecting every unowned transition. */
export function transitionServiceLifecycle(
  state: ServiceLifecycleState,
  event: ServiceLifecycleEvent,
): ServiceLifecycleState {
  const next = TRANSITIONS[state]?.[event];
  if (!next) {
    throw new ServiceLifecycleError(
      'service-lifecycle-transition-invalid',
      `cannot apply ${event} while service is ${state}`,
    );
  }
  return next;
}
