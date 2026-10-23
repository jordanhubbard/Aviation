# Test for frame time and telemetry latency
import pytest
import time

@pytest.mark.performance
def test_frame_time_and_latency():
    # Simulate frame time measurement
    frame_start_time = time.time()
    time.sleep(0.05)  # Simulate frame processing time
    frame_end_time = time.time()

    frame_time = (frame_end_time - frame_start_time) * 1000  # Convert to milliseconds
    assert frame_time < 50, f"Frame time is too high: {frame_time}ms"

    # Simulate telemetry latency measurement
    telemetry_start_time = time.time()
    time.sleep(0.03)  # Simulate telemetry processing time
    telemetry_end_time = time.time()

    telemetry_latency = (telemetry_end_time - telemetry_start_time) * 1000  # Convert to milliseconds
    assert telemetry_latency < 30, f"Telemetry latency is too high: {telemetry_latency}ms"
