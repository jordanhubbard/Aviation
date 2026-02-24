# G1000 Simulator Performance Tests

This directory contains performance tests for the G1000 simulator to ensure it meets
the required performance targets.

## Performance Targets

| Metric | Target | Description |
|--------|--------|-------------|
| PFD Frame Rate | 20 Hz | Primary Flight Display update rate |
| MFD Frame Rate | 5 Hz | Multi-Function Display update rate |
| WebSocket Latency | < 50ms | Round-trip time for WebSocket messages |
| Memory Usage | < 500 MB | Maximum memory consumption |
| CPU Usage | < 40% | Maximum CPU usage on one core |

## Running Tests

### Backend Performance Tests (Python)

```bash
cd apps/g1000-simulator/backend
pip install -r requirements.txt
pytest tests/performance/ -v
```

### Frontend Performance Tests (TypeScript)

```bash
cd apps/g1000-simulator/frontend
npm install
npm run test:perf
```

## Test Structure

- `test_websocket_performance.py` - WebSocket latency and throughput tests
- `test_resource_usage.py` - Memory and CPU usage tests
- `frontend/` - Frontend rendering performance tests

## Metrics Collection

Tests use the following approaches:
- **WebSocket Latency**: Measures round-trip time for ping/pong messages
- **Frame Rate**: Measures time between consecutive render calls
- **Memory**: Uses process memory monitoring
- **CPU**: Measures CPU time during simulation loops
