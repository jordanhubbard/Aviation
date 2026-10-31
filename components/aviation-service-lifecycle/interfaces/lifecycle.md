# `aviation.service.lifecycle` interface

## States

`ServiceLifecycleState` is one of:

- `stopped`: no start hook is executing and the service is not running.
- `starting`: a start hook is executing.
- `running`: startup completed successfully.
- `stopping`: a stop hook is executing.
- `failed`: the most recent start or stop hook failed.

## Events and transitions

`transitionServiceLifecycle(state, event)` returns the next state for these pairs:

| State | Event | Next state |
| --- | --- | --- |
| `stopped` | `start_requested` | `starting` |
| `starting` | `start_succeeded` | `running` |
| `starting` | `start_failed` | `failed` |
| `running` | `stop_requested` | `stopping` |
| `stopping` | `stop_succeeded` | `stopped` |
| `stopping` | `stop_failed` | `failed` |
| `failed` | `reset` | `stopped` |

Every other state/event pair fails with the stable code
`service-lifecycle-transition-invalid`. Inputs are exact, case-sensitive values; the
operation does not normalize aliases or mutate caller-owned data.

Asynchronous hooks, retry policy, clocks and uptime, error detail, logging,
configuration, automatic startup, process signals, HTTP endpoints, ports, resource
cleanup, and scheduling are outside this interface.
