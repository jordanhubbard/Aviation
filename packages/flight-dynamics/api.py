# Flight Dynamics API Layer

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class State(BaseModel):
    data: dict

@app.post('/init')
async def init_state(state: State):
    # Validate and initialize state
    if not state.data:
        raise HTTPException(status_code=400, detail='Invalid payload')
    return {'status': 'initialized', 'data': state.data}

@app.post('/update')
async def update_state(state: State):
    # Validate and update state
    if not state.data:
        raise HTTPException(status_code=400, detail='Invalid payload')
    return {'status': 'updated', 'data': state.data}

@app.post('/reset')
async def reset_state():
    # Reset state
    return {'status': 'reset'}
