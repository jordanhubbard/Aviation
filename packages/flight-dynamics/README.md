# Flight Dynamics Package

A physics-based flight simulation library for aviation applications.

## Overview

The Flight Dynamics package provides a core flight physics engine that simulates aircraft behavior based on control inputs. It includes:

- **6-DOF Equations of Motion**: Accurate aircraft dynamics simulation
- **FastAPI Service**: RESTful API for flight state updates and queries
- **State Serialization**: Efficient state representation for client applications
- **Deterministic Updates**: Consistent physics calculations with fixed time steps

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

## Future Enhancements

- [ ] Aerodynamic modeling (lift, drag, thrust)
- [ ] Engine performance simulation
- [ ] Fuel consumption calculations
- [ ] Environmental effects (wind, turbulence)
- [ ] Landing gear dynamics
- [ ] Autopilot integration

## License

MIT
