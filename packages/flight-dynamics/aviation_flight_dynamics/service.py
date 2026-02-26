from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from aviation_flight_dynamics import FlightPhysics

app = FastAPI()

class ControlInputs(BaseModel):
    throttle: float
    # Add more control inputs as needed

flight_physics = FlightPhysics()

@app.post("/api/flight/update")
async def update_flight(control_inputs: ControlInputs):
    try:
        state = flight_physics.run_update_loop(control_inputs.dict())
        return state
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/flight/state")
async def get_flight_state():
    try:
        return flight_physics.serialize_state()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
