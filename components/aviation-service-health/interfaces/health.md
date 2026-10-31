# `aviation.service.health` interface

## Status

Canonical `HealthStatus` values are:

- `ok`: the service is serving its intended contract.
- `degraded`: the service is serving but has a known impairment.
- `unavailable`: the service cannot serve its intended contract.

Input values are trimmed and case-insensitive. `healthy` and `up` are aliases for
`ok`; `warning` is an alias for `degraded`; `unhealthy` and `down` are aliases for
`unavailable`. An unrecognized value fails with `health-status-invalid`.

## Report construction

`createHealthReport(options)` returns a new mapping with:

- `status`: the normalized canonical status, defaulting to `ok`.
- `service`: the trimmed non-empty service identity when supplied.
- every adapter-owned detail field, copied without interpretation.

The detail keys `status` and `service` are reserved and fail with
`health-details-invalid`. An empty or non-string supplied service identity fails with
`health-service-invalid`. Caller-owned options and details are never mutated.

HTTP routing and status codes, timestamps, dependency checks, readiness/liveness
policy, deployment configuration, logging, metrics, and application detail schemas are
outside this interface.
