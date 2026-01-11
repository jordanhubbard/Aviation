# Running Applications

This guide explains how to run the applications in the Aviation monorepo using the unified Makefile driver system.

## Quick Start

From the monorepo root, you can start any application with a single command:

```bash
# Run any application
make run-aviation-missions
make run-flight-planner
make run-flight-school
make run-foreflight-dashboard
make run-flight-tracker
make run-weather-briefing

# Stop all running applications
make stop-all
```

## Application Details

### Aviation Missions App
**Tech Stack:** Clojure + JavaScript  
**Port:** 8080  
**Command:** `make run-aviation-missions`

```bash
make run-aviation-missions
```

- Builds Docker image with Clojure backend and JavaScript frontend
- Starts the application via Docker Compose
- Access at: http://localhost:8080
- API docs at: http://localhost:8080/api/swagger.json

**Stop:** `cd apps/aviation-missions-app && make stop`

---

### Flight Planner
**Tech Stack:** Python FastAPI + React + TypeScript  
**Ports:** 8000 (backend), 5173 (frontend)  
**Command:** `make run-flight-planner`

```bash
make run-flight-planner
```

- Starts both backend and frontend via Docker Compose
- Backend API at: http://localhost:8000
- Frontend at: http://localhost:5173
- Includes Leaflet maps, terrain profiles, and weather overlays

**Stop:** `cd apps/flightplanner && make stop`

---

### Flight School
**Tech Stack:** Python Flask + SQLite + Bootstrap  
**Port:** 5001  
**Command:** `make run-flight-school`

```bash
make run-flight-school
```

- Creates Python virtual environment automatically
- Installs dependencies
- Initializes SQLite database
- Loads test data (sample students, aircraft, bookings)
- Starts Flask development server
- Access at: http://localhost:5001

**Test Accounts:**
- Admin: admin@example.com / admin123
- Instructor: instructor@example.com / instructor123
- Student: student@example.com / student123

**Stop:** Press `Ctrl+C` in the terminal

---

### ForeFlight Dashboard
**Tech Stack:** Python FastAPI + React + TypeScript  
**Port:** 5051  
**Command:** `make run-foreflight-dashboard`

```bash
make run-foreflight-dashboard
```

- Builds Docker images for backend and frontend
- Starts both services via Docker Compose
- API at: http://localhost:5051
- API docs at: http://localhost:5051/docs
- Frontend served by FastAPI (production build)

**Features:**
- ForeFlight CSV logbook import
- Flight validation and statistics
- Currency tracking
- Data visualization

**Stop:** `cd apps/foreflight-dashboard && make stop`

---

### Flight Tracker
**Tech Stack:** TypeScript + Node.js  
**Port:** 3001  
**Command:** `make run-flight-tracker`

```bash
make run-flight-tracker
```

- Installs npm dependencies
- Builds TypeScript to JavaScript
- Starts the Node.js service
- Access at: http://localhost:3001

**Status:** In development

**Stop:** Press `Ctrl+C` in the terminal or `cd apps/flight-tracker && make stop`

---

### Weather Briefing
**Tech Stack:** TypeScript + Node.js  
**Port:** 3002  
**Command:** `make run-weather-briefing`

```bash
make run-weather-briefing
```

- Installs npm dependencies
- Builds TypeScript to JavaScript
- Starts the Node.js service
- Access at: http://localhost:3002

**Status:** In development (AI-powered weather analysis)

**Stop:** Press `Ctrl+C` in the terminal or `cd apps/weather-briefing && make stop`

---

## Port Summary

| Application              | Port(s)      | Type                |
|-------------------------|--------------|---------------------|
| Aviation Missions App    | 8080         | Clojure + JS        |
| Flight Planner          | 8000, 5173   | Python + React      |
| Flight School           | 5001         | Python Flask        |
| ForeFlight Dashboard    | 5051         | Python + React      |
| Flight Tracker          | 3001         | TypeScript          |
| Weather Briefing        | 3002         | TypeScript          |

All ports are configurable via environment variables in each app's Makefile.

## Running Multiple Apps

You can run multiple applications simultaneously since they use different ports:

```bash
# Terminal 1
make run-flight-school

# Terminal 2
make run-flight-planner

# Terminal 3
make run-flight-tracker
```

Or use background processes:

```bash
# Start all apps in background (Docker-based ones)
cd apps/aviation-missions-app && make start
cd apps/foreflight-dashboard && make start
cd apps/flightplanner && make start

# Stop all at once
make stop-all
```

## Advanced Usage

### Custom Ports

Each application supports custom port configuration:

```bash
# Aviation Missions App
cd apps/aviation-missions-app
PORT=9000 make start

# Flight School
cd apps/flightschool
PORT=6000 make run

# Flight Tracker
cd apps/flight-tracker
PORT=4001 make start
```

### Development vs Production

Some apps have separate development and production modes:

**Flight Planner:**
```bash
cd apps/flightplanner
make dev-up      # Development (with hot reload)
make prod-up     # Production (optimized builds)
```

**ForeFlight Dashboard:**
```bash
cd apps/foreflight-dashboard
make start       # Development
make start-prod  # Production
```

### Individual App Commands

Each app has its own Makefile with additional commands:

```bash
cd apps/<app-name>
make help        # Show available commands
make build       # Build only
make test        # Run tests
make clean       # Clean artifacts
make lint        # Run linters
```

## Troubleshooting

### Port Already in Use

If a port is already in use, either:

1. Stop the conflicting service
2. Use a custom port (see Custom Ports above)
3. Find and kill the process: `lsof -ti:PORT | xargs kill`

### Docker Issues

For Docker-based apps (Aviation Missions, ForeFlight Dashboard, Flight Planner):

```bash
# Clean up Docker resources
cd apps/<app-name>
make clean

# Rebuild from scratch
make start
```

### Python Virtual Environment Issues

For Python apps (Flight School):

```bash
cd apps/flightschool
make clean       # Remove venv and artifacts
make demo        # Recreate everything fresh
```

### TypeScript Build Errors

For TypeScript apps (Flight Tracker, Weather Briefing):

```bash
cd apps/<app-name>
make clean       # Remove node_modules and build artifacts
make build       # Rebuild
```

## Next Steps

- See [Getting Started Guide](GETTING_STARTED.md) for prerequisites and initial setup
- See [README.md](../README.md) for architecture and overview
- See individual app READMEs in `apps/<app-name>/` for app-specific details
- See [Secrets Management](SECRETS_QUICKSTART.md) for configuring API keys
