"""FastAPI service for flight dynamics simulation."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import logging

from .flight_physics import FlightPhysics

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Flight Dynamics Service",
    description="Physics-based flight simulation API",
    version="0.1.0"
)


class ControlInputs(BaseModel):
    """Aircraft control inputs."""
    throttle: float = Field(0.0, ge=0.0, le=1.0, description="Engine throttle (0-1)")
    elevator: float = Field(0.0, ge=-1.0, le=1.0, description="Pitch control (-1 to 1)")
    aileron: float = Field(0.0, ge=-1.0, le=1.0, description="Roll control (-1 to 1)")
    rudder: float = Field(0.0, ge=-1.0, le=1.0, description="Yaw control (-1 to 1)")


class FlightState(BaseModel):
    """Current flight state."""
    position: Dict[str, float]
    velocity: Dict[str, float]
    attitude: Dict[str, float]
    angular_velocity: Dict[str, float]
    throttle: float
    altitude_ft: float
    airspeed_knots: float


# Global flight physics instance
flight_physics = FlightPhysics()


@app.on_event("startup")
async def startup_event():
    """Initialize on startup."""
    logger.info("Flight Dynamics Service starting up")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Flight Dynamics Service shutting down")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "flight-dynamics"}


@app.post("/api/flight/update", response_model=FlightState)
async def update_flight(controls: ControlInputs):
    """Update flight state with control inputs.
    
    Executes a single physics update cycle with the provided control inputs
    and returns the updated flight state.
    
    Args:
        controls: Aircraft control inputs
        
    Returns:
        Updated flight state
        
    Raises:
        HTTPException: If update fails
    """
    try:
        control_dict = controls.dict()
        state = flight_physics.run_update_loop(control_dict)
        return FlightState(**state)
    except Exception as e:
        logger.error(f"Flight update failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Flight update failed: {str(e)}")


@app.get("/api/flight/state", response_model=FlightState)
async def get_flight_state():
    """Get current flight state.
    
    Returns the current aircraft state without applying any control inputs.
    
    Returns:
        Current flight state
        
    Raises:
        HTTPException: If state retrieval fails
    """
    try:
        state = flight_physics.serialize_state()
        return FlightState(**state)
    except Exception as e:
        logger.error(f"State retrieval failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"State retrieval failed: {str(e)}")


@app.post("/api/flight/reset")
async def reset_flight():
    """Reset flight to initial state.
    
    Returns:
        Reset flight state
    """
    try:
        global flight_physics
        flight_physics = FlightPhysics()
        state = flight_physics.serialize_state()
        return {"status": "reset", "state": state}
    except Exception as e:
        logger.error(f"Reset failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
