# G1000 Simulator Performance Tests

This directory contains performance tests for the G1000 simulator, measuring:

## Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| PFD Frame Rate | 20 Hz | Primary Flight Display update rate |
| MFD Frame Rate | 5 Hz | Multi-Function Display update rate |
| WebSocket Latency | < 50ms | Round-trip time for WebSocket messages |
| Memory Usage | < 500 MB | Total application memory consumption |
| CPU Usage | < 40% | CPU utilization on a single core |

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

```
tests/performance/
├── README.md                    # This file
├── __init__.py                  # Python package marker
├── test_websocket_latency.py    # WebSocket latency tests
├── test_server_resources.py     # Memory and CPU tests (server)
└── frontend/
    ├── pfd-framerate.test.ts    # PFD rendering performance
    ├── mfd-framerate.test.ts    # MFD rendering performance
    └── resource-usage.test.ts   # Client-side resource tests
```

## CI Integration

These tests are run as part of the CI pipeline in the `performance-tests` job.
See `.github/workflows/ci.yml` for configuration.
