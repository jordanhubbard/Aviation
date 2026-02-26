"""FastAPI service for flight dynamics simulation."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from .flight_physics import FlightPhysics

app = FastAPI(
    title="Flight Dynamics Service",
    description="Physics-based flight simulation API",
    version="0.1.0"
)


class ControlInputs(BaseModel):
    """Aircraft control inputs."""
    throttle: float = 0.0
    elevator: float = 0.0
    aileron: float = 0.0
    rudder: float = 0.0


class FlightState(BaseModel):
    """Current flight state."""
    position: dict
    velocity: dict
    attitude: dict
    angular_velocity: dict
    throttle: float
    altitude_ft: float
    airspeed_knots: float


# Global flight physics instance
flight_physics = FlightPhysics()


@app.post("/api/flight/update", response_model=FlightState)
async def update_flight(control_inputs: ControlInputs):
    """Update flight state with control inputs.
    
    Args:
        control_inputs: Aircraft control inputs
        
    Returns:
        Updated flight state
        
    Raises:
        HTTPException: If update fails
    """
    try:
        state = flight_physics.run_update_loop(control_inputs.dict())
        return FlightState(**state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/flight/state", response_model=FlightState)
async def get_flight_state():
    """Get current flight state.
    
    Returns:
        Current flight state
        
    Raises:
        HTTPException: If retrieval fails
    """
    try:
        state = flight_physics.serialize_state()
        return FlightState(**state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/flight/reset")
async def reset_flight():
    """Reset flight to initial state.
    
    Returns:
        Confirmation message
    """
    try:
        global flight_physics
        flight_physics = FlightPhysics()
        return {"message": "Flight reset to initial state"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint.
    
    Returns:
        Health status
    """
    return {"status": "healthy", "service": "flight-dynamics"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
