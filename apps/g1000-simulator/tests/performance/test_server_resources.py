# Test for server resource usage
import pytest
import psutil

@pytest.mark.performance
def test_memory_usage():
    # Simulate memory usage measurement
    memory_usage = psutil.virtual_memory().used / (1024 * 1024)  # Convert to MB
    assert memory_usage < 500, f"Memory usage is too high: {memory_usage}MB"

@pytest.mark.performance
def test_cpu_usage():
    # Simulate CPU usage measurement
    cpu_usage = psutil.cpu_percent(interval=1)
    assert cpu_usage < 40, f"CPU usage is too high: {cpu_usage}%"
