# Initialize the backend application
from fastapi import FastAPI
from .services.flight_plan_service import router as flight_plan_router

app = FastAPI()
app.include_router(flight_plan_router, prefix="/flight-plans", tags=["flight-plans"])
