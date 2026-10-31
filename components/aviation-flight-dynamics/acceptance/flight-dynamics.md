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

### Scenario: Axis controllers and flight-director modes are evaluated

- **WHEN** pitch, roll, altitude, and heading errors are applied and a declared mode
  transition, arm, capture, target, and disconnect sequence is requested
- **THEN** controller commands and active/armed flight-director state match the
  declared vectors

### Scenario: Application state is adapted without duplicating transitions

- **WHEN** an application-owned status record is supplied to the mode controller
- **THEN** SDK transitions update that record while read snapshots remain independent

### Scenario: Autotrim and envelope protection are evaluated

- **WHEN** sustained control inputs and declared aircraft states are applied
- **THEN** trim remains bounded and every envelope violation flag matches the vectors

## Requirement: Performance and models agree

### Scenario: Bundled aircraft are validated and a C172 is evaluated

- **WHEN** the model suite, cruise case, and takeoff/climb case are evaluated
- **THEN** model identities, validation counts, and performance values match

### Scenario: Bundled physics models resolve aircraft authority

- **WHEN** the C172S, C182T, and SR22 Perspective models are loaded in an isolated SDK environment
- **THEN** its linked profile ID and every derived operating field match
  `aviation.aircraft`, while its serialized model asset contains no duplicate aircraft
  authority fields

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
