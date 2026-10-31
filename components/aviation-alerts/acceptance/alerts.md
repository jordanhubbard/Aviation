# Aviation alert lifecycle acceptance contract

An independent oracle loads `vectors.json` and evaluates every case against the
TypeScript, Python, and Go SDK realizations. Acceptance performs no network access and
requires no application runtime.

## Requirement: Severity agrees

- Canonical values and the `ok` and `info` aliases normalize identically.
- Empty and unknown values fail with `alert-level-invalid`.
- Priority values increase exactly from `normal` through `warning`.

## Requirement: Lifecycle ordering agrees

- Unacknowledged records precede acknowledged records.
- Severity descends within each acknowledgement group.
- Source order is stable for otherwise equal records.
- Inputs are not mutated.

## Requirement: Acknowledgement and summary agree

- Reconciliation retains only active identifiers and removes duplicate
  acknowledgements while preserving first occurrence order.
- Highest severity excludes acknowledged alerts by default, optionally includes them,
  and returns `normal` for an empty scope.

## Requirement: Common SDK CI runs

- Changes to this Component, its vectors, any realization, package metadata, or the
  SDK workflow run alert conformance independently of application tests.
