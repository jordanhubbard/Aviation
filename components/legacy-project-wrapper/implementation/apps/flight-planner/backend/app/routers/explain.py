"""Flight Planner binds the common worker-safe explanation API."""
from aviation.explanation import create_explanation_router

router = create_explanation_router('flight-planner')
