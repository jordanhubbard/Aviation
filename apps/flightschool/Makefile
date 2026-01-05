.PHONY: help env init run test clean lint format db-migrate db-upgrade db-downgrade test-data check-aircraft-images frontend-test

# Default target when just running 'make'
.DEFAULT_GOAL := help

# Python and virtualenv settings
VENV = venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip
FLASK = $(VENV)/bin/flask
PYTEST = $(VENV)/bin/pytest
COVERAGE = $(VENV)/bin/coverage

# Environment variables for Flask
export FLASK_APP = app
export FLASK_ENV = development
export PYTHONPATH = $(shell pwd)
PORT ?= 5001  # Default port, can be overridden with make run PORT=xxxx
TYPE ?= "Aircraft"

help:
	@echo "Available commands:"
	@echo "  make help         - Show this help message"
	@echo "  make demo         - Do all steps necessary to bring up a demo
	@echo "  make env         - Create and activate Python virtual environment"
	@echo "  make init        - Initialize the application (create venv, install deps, init db)"
	@echo "  make run         - Run the Flask application in development mode"
	@echo "  make test        - Run all tests with pytest"
	@echo "  make clean       - Remove all build, test, and coverage artifacts"
	@echo "  make lint        - Check code style with flake8"
	@echo "  make format      - Format code with black"
	@echo "  make db-migrate  - Generate a new database migration"
	@echo "  make db-upgrade  - Apply all database migrations"
	@echo "  make db-downgrade- Revert last database migration"
	@echo "  make test-data   - Load sample data into the database"
	@echo "  make check-aircraft-images - Check aircraft images"
	@echo "  make frontend-test - Run frontend smoke tests against the running demo instance"

demo: clean init test-data run

query: env
	PYTHONPATH=/Users/jkh/Src/flightschool /Users/jkh/Src/flightschool/venv/bin/python /Users/jkh/Src/flightschool/scripts/db_query_helper.py "${TYPE}.query.all()"

env:
	@echo "Creating virtual environment..."
	@if [ ! -d "$(VENV)" ]; then \
		python -m venv $(VENV); \
		$(PIP) install pip-tools; \
	fi
	@echo "Virtual environment ready. Activate it with: source venv/bin/activate"

init: env
	@echo "Installing dependencies..."
	$(PIP) install -r requirements.txt
	@echo "Creating instance directory..."
	mkdir -p instance
	@echo "Initializing database..."
	. $(VENV)/bin/activate && PYTHONPATH=$(shell pwd) $(PYTHON) scripts/init_db.py
	@echo "Initialization complete."

run: env
	@echo "Installing dependencies..."
	$(PIP) install -r requirements.txt
	@echo "Starting Flask development server on 0.0.0.0:$(PORT)..."
	. $(VENV)/bin/activate && PYTHONPATH=$(shell pwd) $(FLASK) run --debug -h 0.0.0.0 -p $(PORT)

test: init
	@echo "Installing test dependencies..."
	$(PIP) install pytest pytest-cov coverage
	@echo "Running tests with coverage..."
	. $(VENV)/bin/activate && PYTHONPATH=$(shell pwd) $(COVERAGE) run -m pytest -v
	@echo "Generating coverage report..."
	. $(VENV)/bin/activate && $(COVERAGE) report
	. $(VENV)/bin/activate && $(COVERAGE) html
	@echo "Coverage report generated in htmlcov/index.html"

clean:
	@echo "Cleaning project..."
	rm -rf $(VENV)
	rm -rf __pycache__
	rm -rf .pytest_cache
	rm -rf .coverage
	rm -rf htmlcov
	rm -f instance/flightschool.db
	rm -rf instance
	rm -rf migrations
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	@echo "Clean complete."

lint:
	@echo "Installing linting dependencies..."
	$(PIP) install flake8
	@echo "Running flake8..."
	. $(VENV)/bin/activate && $(PYTHON) -m flake8 app tests

format:
	@echo "Installing formatting dependencies..."
	$(PIP) install black
	@echo "Formatting code with black..."
	. $(VENV)/bin/activate && $(PYTHON) -m black app tests

db-migrate:
	@echo "Creating database migration..."
	. $(VENV)/bin/activate && PYTHONPATH=$(shell pwd) $(FLASK) db migrate -m "$(msg)"
	@echo "Migration created. Review migration files and run 'make db-upgrade' to apply."

db-upgrade:
	@echo "Applying database migrations..."
	. $(VENV)/bin/activate && PYTHONPATH=$(shell pwd) $(FLASK) db upgrade
	@echo "Database upgraded."

db-downgrade:
	@echo "Reverting last database migration..."
	. $(VENV)/bin/activate && PYTHONPATH=$(shell pwd) $(FLASK) db downgrade
	@echo "Database downgraded."

test-data:
	@echo "Loading test data..."
	. $(VENV)/bin/activate && PYTHONPATH=$(shell pwd) $(PYTHON) scripts/load_test_data.py
	@echo "Test data loaded successfully."

check-aircraft-images:
	. $(VENV)/bin/activate && PYTHONPATH=$(shell pwd) $(PYTHON) scripts/check_aircraft_images.py

frontend-test:
	@echo "Running frontend smoke tests against the running demo instance..."
	$(VENV)/bin/python -m pytest tests/frontend_smoke_test.py

# Error if running on Windows
ifeq ($(OS),Windows_NT)
$(error This Makefile is not supported on Windows. Please use WSL or Git Bash)
endif
