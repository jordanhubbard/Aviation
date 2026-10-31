# `aviation.alerts` interface

## Severity

Canonical `AlertLevel` values, from lowest to highest priority, are:

- `normal`
- `advisory`
- `caution`
- `warning`

Input values are trimmed and case-insensitive. `ok` and `debug` are compatibility
aliases for `normal`; `info` is the compatibility alias for `advisory`; `critical`
is the compatibility alias for `warning`. An unrecognized value fails with the stable
code `alert-level-invalid`.

## Lifecycle record

A lifecycle record contains:

- `id`: an opaque application-owned string identity.
- `level`: a canonical level or supported alias.
- `acknowledged`: whether the active alert has been acknowledged.

The Component does not interpret or canonicalize `id` and does not define whether an
alert is eligible for acknowledgement.

## Operations

- `normalizeAlertLevel(level)`: return the canonical level or fail closed.
- `alertPriority(level)`: return `0`, `1`, `2`, or `3` for canonical ascending
  priority.
- `orderAlerts(alerts)`: return a new stable list ordered by unacknowledged state,
  descending severity, and source order.
- `reconcileAcknowledgements(activeIds, acknowledgedIds)`: return a new list
  containing only active acknowledgements, de-duplicated in first-occurrence order.
- `highestAlertLevel(alerts, includeAcknowledged=false)`: return the highest canonical
  level in scope, or `normal` when no record is in scope.

All operations leave caller-owned collections and records unchanged. Identifier
generation, threshold detection, timestamps, messages, persistence, events, sounds,
visibility limits, and presentation are outside this interface.
