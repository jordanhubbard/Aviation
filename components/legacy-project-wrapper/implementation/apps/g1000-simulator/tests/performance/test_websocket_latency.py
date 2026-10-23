# Test for WebSocket latency
import pytest
import time

@pytest.mark.performance
def test_websocket_latency():
    # Simulate WebSocket latency measurement
    start_time = time.time()
    # Simulate sending and receiving a WebSocket message
    time.sleep(0.05)  # Simulate 50ms latency
    end_time = time.time()

    latency = (end_time - start_time) * 1000  # Convert to milliseconds
    assert latency < 50, f"WebSocket latency is too high: {latency}ms"
