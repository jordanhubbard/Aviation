.PHONY: all run start dev-up test backend-test

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
backend-test:
	@if [ -d ".venv" ]; then \
		PYTHONPATH=backend .venv/bin/pytest backend/tests/ -ra; \
	elif [ -d "venv" ]; then \
		PYTHONPATH=backend venv/bin/pytest backend/tests/ -ra; \
	else \
		PYTHONPATH=backend python3 -m pytest backend/tests/ -ra; \
	fi
