.PHONY: all run start dev-up test backend-test test-docker

all:
	@echo "Building g1000-simulator"
	@echo "No specific build steps defined yet."

run: start

# Launch the FastAPI backend with uvicorn.
start:
	cd backend && uvicorn main:app --host 0.0.0.0 --port 8000

# Start backend uvicorn server in background and frontend Vite dev server in background.
dev-up:
	cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 &
	pnpm run dev &

# Run JS/TS unit tests via jest.
test:
	node node_modules/.bin/jest --passWithNoTests

# Run Python backend tests following the flight-planner pattern.
COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

backend-test:
	@if [ -d ".venv" ]; then \
		PYTHONPATH=backend .venv/bin/pytest backend/tests/ tests/backend/ -ra; \
	elif [ -d "venv" ]; then \
		PYTHONPATH=backend venv/bin/pytest backend/tests/ tests/backend/ -ra; \
	else \
		PYTHONPATH=backend python3 -m pytest backend/tests/ tests/backend/ -ra; \
	fi

test-docker:
	$(COMPOSE) -f docker-compose.test.yml up --build --abort-on-container-exit
	$(COMPOSE) -f docker-compose.test.yml down -v
