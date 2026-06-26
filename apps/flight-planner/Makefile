.PHONY: help dev-up dev-down backend-test clean test-docker

help:
	@echo "Flight Planner - Available targets:"
	@echo "  dev-up        - Start the dev stack (backend + frontend) via Docker Compose"
	@echo "  dev-down      - Stop and remove the dev stack containers"
	@echo "  backend-test  - Run backend Python tests"
	@echo "  clean         - Remove build artifacts and caches"
	@echo "  test-docker   - Run tests in Docker"

# Start the flight-planner development stack (backend + frontend).
# Uses docker-compose.yml which mounts source for live reload.
dev-up:
	docker compose -f docker-compose.yml up --build

# Stop and remove the dev stack containers and volumes.
dev-down:
	docker compose -f docker-compose.yml down -v

# Run backend Python tests.
# Searches for a local venv first; falls back to the system python3.
backend-test:
	@if [ -d ".venv" ]; then \
		.venv/bin/pytest tests/ -ra; \
	elif [ -d "venv" ]; then \
		venv/bin/pytest tests/ -ra; \
	else \
		python3 -m pytest tests/ -ra; \
	fi

# Remove build artifacts, caches, and byte-compiled files.
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name ".coverage" -delete
	find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	rm -rf frontend/dist frontend/node_modules/.cache 2>/dev/null || true

test-docker:
	docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
	docker-compose -f docker-compose.test.yml down -v
