# G1000 Backend Services

Backend services for the G1000 simulator providing flight dynamics, navigation, weather, real-time data streaming, and demo scenarios.

## Architecture

This backend provides the following services:

1. **Flight Dynamics Service** (Python/FastAPI) - Aircraft physics simulation
2. **Navigation Service** (Python/FastAPI) - Flight plan management and routing
3. **Weather Service** (TypeScript/Node.js) - METAR/TAF and weather integration
4. **Real-Time Streaming Service** (TypeScript/Node.js) - WebSocket server for live data
5. **Demo Flight Service** (Python/FastAPI) - Pre-recorded flight scenarios

## Data Storage

This backend implements persistent data storage with the following options:

- **SQLite** - Local persistence for flight plans, settings, and recordings
- **PostgreSQL** (optional) - Multi-user deployments and cloud storage

## Project Structure

```
g1000-backend/
├── python/
│   ├── flight_dynamics/          # Flight physics simulation
│   ├── navigation/               # Flight plan and routing
│   ├── demo_flights/             # Demo scenario management
│   ├── persistence/              # Data storage layer
│   └── requirements.txt
├── typescript/
│   ├── weather-service/          # Weather integration
│   ├── streaming-service/        # Real-time WebSocket server
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- SQLite 3.x

### Installation

```bash
# Python services
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# TypeScript services
cd ../typescript
npm install
```

## Running Services

### Flight Dynamics Service

```bash
cd python
python -m uvicorn flight_dynamics.main:app --reload --port 8001
```

### Navigation Service

```bash
cd python
python -m uvicorn navigation.main:app --reload --port 8002
```

### Weather Service

```bash
cd typescript
npm run dev -- --port 8003
```

### Real-Time Streaming Service

```bash
cd typescript
npm run dev -- --port 8004
```

## Data Persistence

The backend uses a pluggable persistence layer supporting:

- **SQLite** (default) - Local file-based storage
- **PostgreSQL** - Network-based multi-user storage

### Configuration

Set the `STORAGE_TYPE` environment variable:

```bash
# Use SQLite (default)
export STORAGE_TYPE=sqlite
export SQLITE_DB_PATH=./g1000.db

# Use PostgreSQL
export STORAGE_TYPE=postgresql
export DATABASE_URL=postgresql://user:password@localhost/g1000
```

## API Documentation

See individual service READMEs for detailed API documentation.

## Testing

```bash
# Python tests
cd python
pytest

# TypeScript tests
cd typescript
npm test
```

## License

MIT
