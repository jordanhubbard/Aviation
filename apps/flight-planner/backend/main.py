from __future__ import annotations

from app import create_app
import unittest
from app.config import settings


app = create_app(settings)

if __name__ == '__main__':
    unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.discover('apps/flight-planner/backend/tests'))

# Example usage of GPSSimulationService
from app.services.gps_simulation import GPSSimulationService, GPSState

initial_gps_state = GPSState(lat=37.7749, lon=-122.4194, alt=30.0, speed=100.0, track=90.0, raim=True, epe=5.0)
gps_simulation_service = GPSSimulationService(initial_gps_state)

# Update GPS state
gps_simulation_service.update_state(37.7749, -122.4194, 30.0, 100.0, 90.0)

# Retrieve GPS state
current_gps_state = gps_simulation_service.get_state()
print(f"Current GPS State: {current_gps_state}")

