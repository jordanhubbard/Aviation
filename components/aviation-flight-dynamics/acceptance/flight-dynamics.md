# Aviation flight-dynamics acceptance contract

An independent oracle loads `vectors.json` and evaluates every synthetic case against
the common SDK package. Acceptance does not contact a live aircraft, avionics device,
weather provider, or external service.

## Requirement: Atmosphere and wind agree

### Scenario: Standard sea level and a deterministic gust are evaluated

- **WHEN** the declared ISA and wind inputs are evaluated
- **THEN** all atmosphere fields and wind components match within tolerance

## Requirement: Autopilot primitives agree

### Scenario: A PID controller receives two samples

- **WHEN** the declared gains, errors, and time steps are applied in order
- **THEN** both outputs match and the first sample has no derivative kick

### Scenario: A bounded PID controller saturates

- **WHEN** declared integral and output bounds are exceeded
- **THEN** both controller state and actuator output clamp to those bounds

## Requirement: Performance and models agree

### Scenario: Bundled aircraft are validated and a C172 is evaluated

- **WHEN** the model suite, cruise case, and takeoff/climb case are evaluated
- **THEN** model identities, validation counts, and performance values match

## Requirement: Compatibility formulas agree

### Scenario: A retained application requests scalar physics

- **WHEN** lift, drag, thrust, fuel, wind, and turbulence helpers are called
- **THEN** they return the Component-declared results through the shared package

## Requirement: Invalid values fail closed

### Scenario: Controls or integration time are invalid

- **WHEN** a bounded control exceeds its range or a non-positive step is supplied
- **THEN** the common SDK raises an explicit validation error

## Requirement: Common SDK CI runs

### Scenario: Authority or realization changes

- **WHEN** this Component, its vectors, the Python realization, package metadata, or
  the SDK workflow changes
- **THEN** flight-dynamics conformance runs independently of application tests
