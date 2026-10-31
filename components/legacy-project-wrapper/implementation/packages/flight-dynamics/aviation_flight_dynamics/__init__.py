"""Flight Dynamics Package - Physics simulation for aviation applications."""

from .flight_physics import FlightPhysics
from .instruments import (
    PistonEngineInstrumentProjection,
    coordinated_turn_bank_deg,
    project_piston_engine_instruments,
)

__all__ = [
    "FlightPhysics",
    "PistonEngineInstrumentProjection",
    "coordinated_turn_bank_deg",
    "project_piston_engine_instruments",
]
__version__ = "0.4.0"
