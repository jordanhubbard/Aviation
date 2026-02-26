"""Core flight physics engine for aircraft simulation."""

import numpy as np
from typing import Dict, Any


class FlightPhysics:
    """6-DOF flight dynamics simulation engine.
    
    Manages aircraft state and updates based on control inputs.
    Implements deterministic physics calculations with fixed time steps.
    """
    
    def __init__(self, dt: float = 0.016):
        """Initialize flight physics engine.
        
        Args:
            dt: Time step in seconds (default 16ms for ~60Hz update)
        """
        self.dt = dt
        self.state = {
            'position': np.array([0.0, 0.0, 0.0]),  # x, y, z (feet)
            'velocity': np.array([0.0, 0.0, 0.0]),  # vx, vy, vz (ft/s)
            'attitude': np.array([0.0, 0.0, 0.0]),  # roll, pitch, yaw (degrees)
            'angular_velocity': np.array([0.0, 0.0, 0.0]),  # p, q, r (deg/s)
            'throttle': 0.0,
            'altitude_ft': 0.0,
            'airspeed_knots': 0.0,
        }
    
    def update(self, control_inputs: Dict[str, float]) -> None:
        """Update flight state based on control inputs.
        
        Args:
            control_inputs: Dictionary with control values
                - throttle: 0.0 to 1.0
                - elevator: -1.0 to 1.0 (pitch control)
                - aileron: -1.0 to 1.0 (roll control)
                - rudder: -1.0 to 1.0 (yaw control)
        """
        throttle = control_inputs.get('throttle', 0.0)
        elevator = control_inputs.get('elevator', 0.0)
        aileron = control_inputs.get('aileron', 0.0)
        rudder = control_inputs.get('rudder', 0.0)
        
        # Simple physics model
        # Update throttle
        self.state['throttle'] = np.clip(throttle, 0.0, 1.0)
        
        # Update velocity based on throttle (simplified)
        max_airspeed = 120.0  # knots
        target_airspeed = self.state['throttle'] * max_airspeed
        self.state['airspeed_knots'] += (target_airspeed - self.state['airspeed_knots']) * 0.1
        
        # Update attitude based on control inputs
        self.state['attitude'][0] += aileron * 2.0 * self.dt  # roll
        self.state['attitude'][1] += elevator * 2.0 * self.dt  # pitch
        self.state['attitude'][2] += rudder * 1.0 * self.dt  # yaw
        
        # Clamp attitudes
        self.state['attitude'] = np.clip(self.state['attitude'], -90, 90)
        
        # Update position based on velocity
        # Convert airspeed to ft/s (1 knot = 1.68781 ft/s)
        velocity_fts = self.state['airspeed_knots'] * 1.68781
        
        # Simple forward motion
        self.state['position'][0] += velocity_fts * self.dt
        
        # Update altitude based on pitch
        pitch_rad = np.radians(self.state['attitude'][1])
        vertical_speed = velocity_fts * np.sin(pitch_rad)
        self.state['altitude_ft'] += vertical_speed * self.dt
        self.state['position'][2] = self.state['altitude_ft']
    
    def serialize_state(self) -> Dict[str, Any]:
        """Serialize current flight state for transmission.
        
        Returns:
            Dictionary with serializable state values
        """
        return {
            'position': {
                'x': float(self.state['position'][0]),
                'y': float(self.state['position'][1]),
                'z': float(self.state['position'][2]),
            },
            'velocity': {
                'vx': float(self.state['velocity'][0]),
                'vy': float(self.state['velocity'][1]),
                'vz': float(self.state['velocity'][2]),
            },
            'attitude': {
                'roll': float(self.state['attitude'][0]),
                'pitch': float(self.state['attitude'][1]),
                'yaw': float(self.state['attitude'][2]),
            },
            'angular_velocity': {
                'p': float(self.state['angular_velocity'][0]),
                'q': float(self.state['angular_velocity'][1]),
                'r': float(self.state['angular_velocity'][2]),
            },
            'throttle': float(self.state['throttle']),
            'altitude_ft': float(self.state['altitude_ft']),
            'airspeed_knots': float(self.state['airspeed_knots']),
        }
    
    def run_update_loop(self, control_inputs: Dict[str, float]) -> Dict[str, Any]:
        """Execute single update cycle with deterministic cadence.
        
        Args:
            control_inputs: Control input dictionary
            
        Returns:
            Serialized flight state after update
        """
        self.update(control_inputs)
        return self.serialize_state()
