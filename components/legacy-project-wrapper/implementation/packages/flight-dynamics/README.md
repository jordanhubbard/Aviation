# Flight Dynamics Package

A physics-based flight simulation library for aviation applications.

## Overview

The Flight Dynamics package is the Python realization of the
`aviation.flight-dynamics` Component. It includes:

- **6-DOF Equations of Motion**: Euler and RK4 rigid-body integration
- **Atmosphere and Wind**: ISA density/pressure/temperature plus deterministic gusts
  and turbulence
- **Aircraft Models**: Validated C172, C182, and SR22 configurations and variants
- **Performance**: Cruise, takeoff, climb, and reference-envelope validation
- **Autopilot Primitives**: Bounded or unbounded PID, axis controllers, mode
  transitions, autotrim, and envelope protection, all covered by Component-owned
  deterministic vectors
- **FastAPI Service**: RESTful API for flight state updates and queries
- **State Serialization**: Efficient state representation for client applications
- **Deterministic Updates**: Consistent physics calculations with fixed time steps

The bundled C172S physics model depends on the Python `aviation-shared-sdk` realization
of `aviation.aircraft` for identity and published operating/reference values. Its local
model asset contains only physics-specific mass, aerodynamic, engine, control, and fuel
density data.

## Installation

```bash
pip install -e .
```

## Usage

### As a Library

```python
from aviation_flight_dynamics import FlightPhysics

physics = FlightPhysics()
state = physics.run_update_loop({'throttle': 0.5})
print(state)
```

### As a Service

```bash
uvicorn aviation_flight_dynamics.service:app --reload
```

Then make requests to:
- `POST /api/flight/update` - Update flight state with control inputs
- `GET /api/flight/state` - Get current flight state

## API Endpoints

### POST /api/flight/update

Update the flight state with control inputs.

**Request:**
```json
{
  "throttle": 0.5
}
```

**Response:**
```json
{
  "position": 0.5
}
```

### GET /api/flight/state

Retrieve the current flight state.

**Response:**
```json
{
  "position": 0.5
}
```

## Architecture

### FlightPhysics Class

The core physics engine that manages aircraft state and updates.

**Methods:**
- `update(control_inputs)` - Update state based on control inputs
- `serialize_state()` - Get current state as dictionary
- `run_update_loop(control_inputs)` - Single update cycle

## Testing

```bash
pytest
```

## Development

Install development dependencies:

```bash
pip install -e ".[dev]"
```

The package suite loads `conformance/vectors.json`, checks it against Component
authority in a full repository checkout, and runs without network access. Use the
repository's `make test-flight-dynamics` target for the independently provisioned
acceptance environment.

## License

MIT
