
import pytest
import time
from apps.flight_planner.backend.app.services.telemetry_streaming_hub import TelemetryStreamingHub

@pytest.fixture
async def telemetry_hub():
    hub = TelemetryStreamingHub()
    yield hub

@pytest.mark.asyncio
async def test_telemetry_latency(telemetry_hub):
    # Simulate telemetry data
    start_time = time.time()
    await telemetry_hub.broadcast('telemetry', {'data': 'test'})
    end_time = time.time()

    latency = end_time - start_time
    print(f"Telemetry latency: {latency} seconds")

    assert latency < 0.1  # Example threshold

@pytest.mark.asyncio
async def test_frame_time_profiling():
    from apps.flight_planner.frontend.src.utils.performanceProfiler import startPerformanceProfiling

    profiler = startPerformanceProfiling()
    time.sleep(2)  # Run the profiler for 2 seconds

    avg_fps = sum(profiler['fps']) / len(profiler['fps'])
    avg_frame_time = sum(profiler['frameTimes']) / len(profiler['frameTimes'])

    print(f"Average FPS: {avg_fps}")
    print(f"Average Frame Time: {avg_frame_time} ms")

    assert avg_fps > 30  # Example threshold for FPS
    assert avg_frame_time < 33.33  # Example threshold for frame time (30 FPS)
