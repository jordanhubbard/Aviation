# Aviation logbook acceptance contract

An independent oracle loads `vectors.json` and evaluates every case against both common
SDK language bindings. Acceptance does not parse a provider file or contact a service.

## Requirement: Language bindings agree

### Scenario: A qualified logbook case is evaluated

- **WHEN** each acceptance input and tolerance is validated
- **THEN** TypeScript and Python return the declared validity, normalized role,
  normalized PIC time, accounted time, and ordered issue codes
- **AND** neither realization mutates the supplied input

## Requirement: Overlapping categories are not double counted

### Scenario: PIC, dual-received, or solo categories overlap

- **WHEN** the qualified overlap cases are evaluated
- **THEN** full-flight PIC plus dual-received is accepted for a non-student
- **AND** solo already contained within PIC is not added again
- **AND** student solo accounts for flight time without inventing PIC time

## Requirement: Invalid primitives fail closed

### Scenario: A duration, count, role, or tolerance is invalid

- **WHEN** it is negative, non-finite, non-integral where required, or unsupported
- **THEN** a stable structured error is returned
- **AND** invalid primitive inputs do not produce a misleading accounted time

## Requirement: Common SDK CI runs

### Scenario: Authority or realization changes

- **WHEN** this Component, its vectors, either realization, package metadata, or the
  SDK workflow changes
- **THEN** logbook conformance runs independently of ForeFlight application tests

