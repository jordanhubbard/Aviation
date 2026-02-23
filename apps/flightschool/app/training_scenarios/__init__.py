"""Training Scenarios Module.

This module provides pre-recorded training scenarios for flight training.
Scenarios include pattern work, GPS approaches, cross-country flights, and emergencies.
"""

from .models import TrainingScenario, ScenarioWaypoint, ScenarioEvent
from .loader import load_scenario, list_scenarios

__all__ = [
    'TrainingScenario',
    'ScenarioWaypoint', 
    'ScenarioEvent',
    'load_scenario',
    'list_scenarios',
]
