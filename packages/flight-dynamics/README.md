# @aviation/flight-dynamics

Flight physics simulation engine for aviation applications.

## Overview

This package provides a physics-based flight simulation library with support for:

- 6-DOF equations of motion
- Aerodynamic force/moment calculations
- Propulsion modeling
- Atmospheric effects
- Aircraft performance calculations

## Installation

```bash
pip install -e .
```

## Usage

```python
from aviation_flight_dynamics import FlightPhysics

# Initialize physics engine
physics = FlightPhysics()

# Update with control inputs
control_inputs = {
    'throttle': 0.8,
    'pitch': 0.1,
    'roll': 0.0,
    'yaw': 0.0
}

state = physics.run_update_loop(control_inputs)
print(state)
```

## Architecture

### Core Modules

- `flight_physics.py` - Main physics engine with 6-DOF equations of motion
- `aircraft_model.py` - Aircraft configuration and characteristics
- `aerodynamics.py` - Aerodynamic force/moment calculations
- `propulsion.py` - Engine simulation
- `atmosphere.py` - Atmospheric modeling

## Development

```bash
# Install with dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run with coverage
pytest --cov=aviation_flight_dynamics
```

## API Reference

### FlightPhysics

#### Methods

- `update(control_inputs)` - Update flight state based on control inputs
- `serialize_state()` - Get current flight state as dictionary
- `run_update_loop(control_inputs)` - Run one physics update cycle

#### Control Inputs

```python
{
    'throttle': float,      # 0.0 to 1.0
    'pitch': float,         # -1.0 to 1.0 (radians)
    'roll': float,          # -1.0 to 1.0 (radians)
    'yaw': float            # -1.0 to 1.0 (radians)
}
```

#### Flight State

```python
{
    'position': float,      # Current position
    'velocity': float,      # Current velocity
    'attitude': dict,       # Pitch, roll, yaw
    'altitude': float,      # Current altitude
    'airspeed': float       # Current airspeed
}
```

## License

MIT
