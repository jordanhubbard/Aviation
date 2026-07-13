from __future__ import annotations

from app import create_app
from app.config import settings


app = create_app(settings)

if __name__ == '__main__':
    import uvicorn
    from app.services.gps_simulation import GPSSimulationService, GPSState
    from app.services.approaches import ApproachProcedure, ApproachType, ApproachCategory, Waypoint, MissedApproachAction
    from app.services.telemetry_recording import TelemetryRecordingService

    initial_gps_state = GPSState(lat=37.7749, lon=-122.4194, alt=30.0, speed=100.0, track=90.0, raim=True, epe=5.0)
    gps_simulation_service = GPSSimulationService(initial_gps_state)
    telemetry_recording_service = TelemetryRecordingService()

    # Start telemetry recording
    telemetry_recording_service.start_recording()

    # Simulate different approaches
    approaches = ['LNAV', 'LNAV/VNAV', 'LPV', 'ILS', 'LOC', 'VTF', 'Missed', 'Visual']
    for approach in approaches:
        gps_simulation_service.simulate_approach(approach)

    # Update GPS state and capture telemetry
    for _ in range(10):
        gps_simulation_service.update_state(37.7749, -122.4194, 30.0, 100.0, 90.0)
        current_gps_state = gps_simulation_service.get_state()
        telemetry_recording_service.capture_snapshot(current_gps_state)

    # Stop telemetry recording
    telemetry_recording_service.stop_recording()

    # Retrieve and print telemetry snapshots
    snapshots = telemetry_recording_service.get_snapshots()
    for snapshot in snapshots:
        print(f"Timestamp: {snapshot.timestamp}, GPS State: {snapshot.gps_state}")

    uvicorn.run(app, host="0.0.0.0", port=8000)
