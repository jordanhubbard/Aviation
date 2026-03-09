"""Flight Dynamics Service - FastAPI REST API for flight simulation."""

from .api import create_app, router
from .models import (
    FlightInitRequest,
    FlightUpdateRequest,
    FlightStateResponse,
    FlightResetRequest,
    EnvironmentConfig,
    ControlInputsModel,
    Vector3Model,
    QuaternionModel,
)
from .simulation import FlightSimulation, SimulationManager

__all__ = [
    "create_app",
    "router",
    "FlightInitRequest",
    "FlightUpdateRequest",
    "FlightStateResponse",
    "FlightResetRequest",
    "EnvironmentConfig",
    "ControlInputsModel",
    "Vector3Model",
    "QuaternionModel",
    "FlightSimulation",
    "SimulationManager",
]
