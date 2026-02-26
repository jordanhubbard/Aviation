# @aviation/flight-dynamics

Flight physics simulation engine for aviation applications.

## Overview

This package provides a physics-based flight simulation library for the Aviation monorepo. It includes:

- **6-DOF Equations of Motion**: Full six-degree-of-freedom flight dynamics
- **Aerodynamic Modeling**: Lift, drag, and thrust calculations
- **Engine Performance**: Piston and turboprop engine simulation
- **Atmospheric Effects**: Wind, turbulence, and standard atmosphere modeling
- **Performance Calculations**: Takeoff, climb, cruise, and descent performance

## Installation

```bash
pip install -e .
```

## Quick Start

```python
from aviation_flight_dynamics import FlightPhysics

# Initialize the physics engine
physics = FlightPhysics()

# Update with control inputs
control_inputs = {
    'throttle': 0.8,
    'pitch': 5.0,
    'roll': 0.0,
    'yaw': 0.0
}

# Run update loop
state = physics.run_update_loop(control_inputs)
print(state)
```

## Architecture

### Core Modules

- `flight_physics.py` - Main physics engine with 6-DOF equations of motion
- `aircraft_model.py` - Aircraft configuration and characteristics
- `aerodynamics.py` - Aerodynamic force and moment calculations
- `propulsion.py` - Engine performance simulation
- `atmosphere.py` - Atmospheric modeling (ISA, wind, turbulence)
- `performance.py` - Performance calculations (takeoff, climb, cruise, descent)

### State Representation

The flight state includes:

```python
{
    'position': {'x': 0, 'y': 0, 'z': 0},      # Position in NED frame (meters)
    'velocity': {'u': 0, 'v': 0, 'w': 0},      # Velocity in body frame (m/s)
    'attitude': {'phi': 0, 'theta': 0, 'psi': 0},  # Euler angles (radians)
    'angular_velocity': {'p': 0, 'q': 0, 'r': 0},  # Angular velocity (rad/s)
    'engine': {'rpm': 0, 'fuel_flow': 0},      # Engine parameters
    'fuel': {'quantity': 0, 'endurance': 0},   # Fuel state
}
```

## API

### FlightPhysics

#### `__init__()`
Initialize the physics engine with default aircraft configuration.

#### `update(control_inputs)`
Update the flight state based on control inputs.

**Parameters:**
- `control_inputs` (dict): Control surface deflections and throttle
  - `throttle` (0-1): Engine throttle setting
  - `pitch` (degrees): Pitch control input
  - `roll` (degrees): Roll control input
  - `yaw` (degrees): Yaw control input

#### `serialize_state()`
Serialize the current flight state for transmission to clients.

**Returns:**
- `dict`: Current flight state

#### `run_update_loop(control_inputs)`
Run a single update cycle with deterministic cadence.

**Parameters:**
- `control_inputs` (dict): Control inputs for this cycle

**Returns:**
- `dict`: Updated flight state

## Integration with Flight Dynamics Service

The flight physics engine is designed to integrate with the Flight Dynamics Service (FastAPI backend):

```python
from fastapi import FastAPI
from aviation_flight_dynamics import FlightPhysics

app = FastAPI()
physics = FlightPhysics()

@app.post("/api/flight/update")
async def update_flight(control_inputs: dict):
    state = physics.run_update_loop(control_inputs)
    return {"state": state}

@app.get("/api/flight/state")
async def get_flight_state():
    return {"state": physics.serialize_state()}
```

## Testing

Run tests with pytest:

```bash
pytest tests/
```

With coverage:

```bash
pytest --cov=aviation_flight_dynamics tests/
```

## Development

Install development dependencies:

```bash
pip install -e ".[dev]"
```

## License

MIT License - See LICENSE file for details
