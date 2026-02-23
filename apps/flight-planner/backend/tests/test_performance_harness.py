
import pytest
import time
from apps.flight_planner.backend.app.services.telemetry_streaming_hub import TelemetryStreamingHub
from apps.flight_planner.backend.app.services.flight_dynamics import FlightDynamicsService, AircraftState

@pytest.fixture
async def telemetry_hub():
    hub = TelemetryStreamingHub()
    yield hub

@pytest.fixture
def flight_dynamics_service():
    aircraft_state = AircraftState(position=(0, 0), velocity=100, altitude=10000, heading=90, fuel_level=100)
    alert_service = None  # Mock or create a real alert service
    service = FlightDynamicsService(aircraft_state, alert_service)
    return service

@pytest.mark.asyncio
async def test_telemetry_latency(telemetry_hub):
    # Simulate telemetry data
    start_time = time.time()
    await telemetry_hub.broadcast('telemetry', {'data': 'test'})
    end_time = time.time()

    latency = end_time - start_time
    print(f"Telemetry latency: {latency} seconds")

    assert latency < 0.1  # Example threshold


def test_frame_time_profiling(flight_dynamics_service):
    start_time = time.time()
    for _ in range(100):  # Simulate 100 frames
        flight_dynamics_service.update_state(
            lift_coefficient=1.0,
            drag_coefficient=0.02,
            power=1000,
            engine_factor=1.0,
            fuel_efficiency=0.8,
            wind_speed=10,
            wind_angle=0,
            turbulence_intensity=0.1,
            air_density=1.225,
            wing_area=16.2,
            target_pitch=5,
            target_roll=0,
            target_altitude=10000,
            target_heading=90,
            oil_pressure=50,
            electrical_status=100
        )
    end_time = time.time()

    total_time = end_time - start_time
    avg_frame_time = total_time / 100

    print(f"Average Frame Time: {avg_frame_time} seconds")

    assert avg_frame_time < 0.033  # Example threshold for 30 FPS
