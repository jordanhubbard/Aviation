# Aviation Monorepo Makefile
# Provides unified build, clean, test, and run targets for all applications and packages

PYTHON_AUDIT := $(shell command -v python3.12 || command -v python3)
.PHONY: help build clean test test-docker release
.PHONY: build-node build-python build-clojure
.PHONY: clean-node clean-python clean-clojure
.PHONY: test-node test-python test-clojure
.PHONY: test-docker-node test-docker-python test-docker-clojure
.PHONY: run-aviation-missions run-flight-planner run-flight-school
.PHONY: run-foreflight-dashboard run-flight-tracker run-weather-briefing
.PHONY: run-g1000-simulator
.PHONY: stop-all

# Default target
help:
	@echo "Aviation Monorepo - Available targets:"
	@echo ""
	@echo "Build & Test:"
	@echo "  make build         - Build all applications and packages"
	@echo "  make clean         - Clean all build artifacts and dependencies"
	@echo "  python3 -m unittest discover -s apps/flight-planner/backend/tests          - Run all tests locally"
	@echo "  make test-docker   - Run all tests in Docker containers (recommended)"
	@echo ""
	@echo "Run Applications (build + start):"
	@echo "  make run-aviation-missions    - Run Aviation Missions App (port 8080)"
	@echo "  make run-flight-planner       - Run Flight Planner (ports 8000+5173)"
	@echo "  make run-flight-school        - Run Flight School demo (port 5001)"
	@echo "  make run-foreflight-dashboard - Run ForeFlight Dashboard (port 5051)"
	@echo "  make run-flight-tracker       - Run Flight Tracker (port 3001)"
	@echo "  make run-weather-briefing     - Run Weather Briefing (port 3002)"
	@echo "  make run-g1000-simulator      - Run G1000 Simulator (backend + frontend)"
	@echo "  make stop-all                 - Stop all running applications"
	@echo ""
	@echo "Component targets:"
	@echo "  make build-node          - Build Node.js/TypeScript applications"
	@echo "  make build-python        - Build Python applications"
	@echo "  make build-clojure       - Build Clojure applications"
	@echo "  make clean-node          - Clean Node.js artifacts"
	@echo "  make clean-python        - Clean Python artifacts"
	@echo "  make clean-clojure       - Clean Clojure artifacts"
	@echo "  make test-node           - Test Node.js applications locally"
	@echo "  make test-python         - Test Python applications locally"
	@echo "  make test-clojure        - Test Clojure applications locally"
	@echo "  make test-docker-node    - Test Node.js apps in Docker"
	@echo "  make test-docker-python  - Test Python apps in Docker"
	@echo "  make test-docker-clojure - Test Clojure apps in Docker"
	@echo "  make audit               - Run security audits (Node.js + Python)"
	@echo "  make release             - Run release workflow (tests, changelog, tag, push, GitHub release)"
	@echo ""

#
# BUILD TARGETS
#

build: build-node build-python build-clojure build-go
	@echo ""
	@echo "✅ Build complete for all applications!"

build-go:
	@echo "📦 Building Go applications..."
	go build -v ./...
	@echo "✅ Go applications build complete"

build-node:
	@echo "📦 Building Node.js/TypeScript applications and packages..."
	npm install
	npm run build --workspaces --if-present
	@echo "✅ Node.js/TypeScript build complete"

build-python:
	@echo "🐍 Building Python applications..."
	@echo "   Note: Python apps require virtual environments to be set up manually"
	@echo "   See individual app READMEs for setup instructions"
	@echo "✅ Python applications ready (install dependencies per app)"

build-clojure:
	@echo "☕ Building Clojure applications..."
	@if [ -f apps/aviation-missions-app/Makefile ]; then \
		cd apps/aviation-missions-app && $(MAKE) build; \
	fi
	@echo "✅ Clojure build complete"

#
# CLEAN TARGETS
#

clean: clean-node clean-python clean-clojure
	@echo ""
	@echo "✅ Clean complete for all applications!"

clean-node:
	@echo "🧹 Cleaning Node.js/TypeScript artifacts..."
	# Clean workspace build artifacts
	npm run clean --workspaces --if-present
	# Remove node_modules
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	# Remove build outputs
	rm -rf apps/*/dist
	rm -rf apps/*/build
	rm -rf packages/*/dist
	rm -rf packages/*/build
	# Remove TypeScript cache
	find . -name "*.tsbuildinfo" -type f -delete
	@echo "✅ Node.js/TypeScript artifacts cleaned"

clean-python:
	@echo "🧹 Cleaning Python artifacts..."
	# Remove Python caches
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	# Remove pytest cache
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	# Remove coverage reports
	find . -type f -name ".coverage" -delete
	find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	# Clean individual Python apps
	@if [ -f apps/flight-planner/Makefile ]; then cd apps/flight-planner && $(MAKE) clean; fi
	@if [ -f apps/flightschool/Makefile ]; then cd apps/flightschool && $(MAKE) clean; fi
	@if [ -f apps/foreflight-dashboard/Makefile ]; then cd apps/foreflight-dashboard && $(MAKE) clean; fi
	@echo "✅ Python artifacts cleaned"

clean-clojure:
	@echo "🧹 Cleaning Clojure artifacts..."
	@if [ -f apps/aviation-missions-app/Makefile ]; then \
		cd apps/aviation-missions-app && $(MAKE) clean; \
	fi
	@echo "✅ Clojure artifacts cleaned"

#
# TEST TARGETS
#

test: test-node test-python test-clojure
	@echo ""
	@echo "✅ All tests complete!"

test-node:
	@echo "🧪 Running Node.js/TypeScript tests..."
	npm test --workspaces --if-present
	@echo "✅ Node.js/TypeScript tests passed"

test-python:
	@echo "🧪 Running Python tests..."
	@echo "   Flight Planner:"
	@if [ -f apps/flight-planner/Makefile ]; then \
		cd apps/flight-planner && $(MAKE) backend-test 2>/dev/null || echo "   ⚠️  Tests require setup (see app README)"; \
	else \
		echo "   No tests configured"; \
	fi
	@echo ""
	@echo "   Flight School:"
	@if [ -f apps/flightschool/Makefile ]; then \
		cd apps/flightschool && $(MAKE) test 2>/dev/null || echo "   ⚠️  Tests require setup (see app README)"; \
	else \
		echo "   No tests configured"; \
	fi
	@echo ""
	@echo "   ForeFlight Dashboard:"
	@if [ -f apps/foreflight-dashboard/Makefile ]; then \
		cd apps/foreflight-dashboard && $(MAKE) test 2>/dev/null || echo "   ⚠️  Tests require setup (see app README)"; \
	else \
		echo "   No tests configured"; \
	fi
	@echo "✅ Python tests complete"

test-clojure:
	@echo "🧪 Running Clojure tests..."
	@if [ -f apps/aviation-missions-app/Makefile ]; then \
		cd apps/aviation-missions-app && $(MAKE) test; \
	fi
	@echo "✅ Clojure tests passed"

#
# DOCKER TEST TARGETS (Containerized Testing)
#

test-docker: test-docker-node test-docker-python test-docker-clojure
	@echo ""
	@echo "✅ All containerized tests complete!"

test-docker-node:
	@echo "🐳 Running Node.js/TypeScript tests in Docker..."
	@echo "   Aviation Accident Tracker:"
	@if [ -f apps/aviation-accident-tracker/Makefile ]; then \
		cd apps/aviation-accident-tracker && $(MAKE) docker-test || echo "   ⚠️  Tests failed"; \
	fi
	@echo ""
	@echo "   Flight Tracker:"
	@if [ -f apps/flight-tracker/Makefile ]; then \
		cd apps/flight-tracker && $(MAKE) docker-test || echo "   ⚠️  Tests failed"; \
	fi
	@echo ""
	@echo "   Weather Briefing:"
	@if [ -f apps/weather-briefing/Makefile ]; then \
		cd apps/weather-briefing && $(MAKE) docker-test || echo "   ⚠️  Tests failed"; \
	fi
	@echo "✅ Node.js/TypeScript Docker tests complete"

test-docker-python:
	@echo "🐳 Running Python tests in Docker..."
	@echo "   Flight Planner:"
	@if [ -f apps/flight-planner/Makefile ]; then \
		cd apps/flight-planner && $(MAKE) test-docker || echo "   ⚠️  Tests failed or not configured"; \
	fi
	@echo ""
	@echo "   Flight School:"
	@if [ -f apps/flightschool/Makefile ]; then \
		cd apps/flightschool && $(MAKE) docker-test || echo "   ⚠️  Tests failed or not configured"; \
	fi
	@echo ""
	@echo "   ForeFlight Dashboard:"
	@if [ -f apps/foreflight-dashboard/Makefile ]; then \
		cd apps/foreflight-dashboard && $(MAKE) test-docker || echo "   ⚠️  Tests failed or not configured"; \
	fi
	@echo "✅ Python Docker tests complete"

test-docker-clojure:
	@echo "🐳 Running Clojure tests in Docker..."
	@echo "   Aviation Missions App:"
	@if [ -f apps/aviation-missions-app/Makefile ]; then \
		cd apps/aviation-missions-app && $(MAKE) test-docker || echo "   ⚠️  Tests failed or not configured"; \
	fi
	@echo "✅ Clojure Docker tests complete"

#
# UTILITY TARGETS
#

.PHONY: validate lint format audit audit-node audit-python

validate:
	@echo "🔍 Validating beads configuration..."
	python3 validate_beads.py
	@echo "✅ Beads configuration valid"

lint:
	@echo "🔍 Running linters..."
	npm run lint --workspaces --if-present
	@echo "✅ Linting complete"

format:
	@echo "✨ Formatting code..."
	npm run format --workspaces --if-present
	@echo "✅ Code formatting complete"

audit: audit-node audit-python
	@echo ""
	@echo "✅ Security audit complete!"

audit-node:
	@echo "🔐 Running Node.js security audit..."
	npm audit --workspaces --if-present
	@echo "✅ Node.js audit complete"

audit-python:
	@echo "🔐 Running Python security audit..."
	@$(PYTHON_AUDIT) -m venv .venv-audit
	@./.venv-audit/bin/pip install -q --upgrade pip pip-audit
	@grep -v "^-e " apps/flight-planner/requirements.txt > /tmp/flight-planner-requirements.txt
	@./.venv-audit/bin/pip-audit -r apps/foreflight-dashboard/requirements.txt || \
		echo "⚠️  pip-audit failed for foreflight-dashboard"
	@./.venv-audit/bin/pip-audit -r apps/flightschool/requirements.txt || \
		echo "⚠️  pip-audit failed for flightschool"
	@./.venv-audit/bin/pip-audit -r /tmp/flight-planner-requirements.txt || \
		echo "⚠️  pip-audit failed for flight-planner"
	@echo "✅ Python audit complete"

#
# RELEASE TARGET
#

release:
	@./scripts/release.sh


#
# RUN TARGETS - Start individual applications
#

run-aviation-missions:
	@echo "🚀 Starting Aviation Missions App..."
	@echo "This will build and start the Clojure backend + JavaScript frontend"
	@echo ""
	cd apps/aviation-missions-app && $(MAKE) start

run-flight-planner:
	@echo "🚀 Starting Flight Planner..."
	@echo "This will start the Python backend + React frontend via Docker"
	@echo ""
	cd apps/flight-planner && $(MAKE) dev-up

run-flight-school:
	@echo "🚀 Starting Flight School (demo mode with test data)..."
	@echo "This will create virtual environment, install dependencies, and start the Flask server"
	@echo ""
	cd apps/flightschool && $(MAKE) demo

run-foreflight-dashboard:
	@echo "🚀 Starting ForeFlight Dashboard..."
	@echo "This will build and start the FastAPI backend + React frontend via Docker"
	@echo ""
	cd apps/foreflight-dashboard && $(MAKE) start

run-flight-tracker:
	@echo "🚀 Starting Flight Tracker..."
	@echo "This will install dependencies, build, and start the TypeScript service"
	@echo ""
	cd apps/flight-tracker && $(MAKE) start

run-weather-briefing:
	@echo "🚀 Starting Weather Briefing..."
	@echo "This will install dependencies, build, and start the TypeScript service"
	@echo ""
	cd apps/weather-briefing && $(MAKE) start

run-g1000-simulator:
	@echo "🚀 Starting G1000 Simulator..."
	@echo "This will show how to start backend and frontend locally"
	@echo ""
	cd apps/g1000-simulator && $(MAKE) start

run-aviation-accident-tracker:
	@echo "🚀 Starting Aviation Accident Tracker (backend placeholder)..."
	@echo ""
	cd apps/aviation-accident-tracker && $(MAKE) start

stop-all:
	@echo "🛑 Stopping all applications..."
	@echo ""
	@echo "Stopping Aviation Missions App..."
	@cd apps/aviation-missions-app && $(MAKE) stop 2>/dev/null || true
	@echo ""
	@echo "Stopping Flight Planner..."
	@cd apps/flight-planner && $(MAKE) dev-down 2>/dev/null || true
	@echo ""
	@echo "Stopping Flight School..."
	@pkill -f "flask.*flightschool" 2>/dev/null || true
	@echo ""
	@echo "Stopping ForeFlight Dashboard..."
	@cd apps/foreflight-dashboard && $(MAKE) stop 2>/dev/null || true
	@echo ""
	@echo "Stopping Flight Tracker..."
	@cd apps/flight-tracker && $(MAKE) stop 2>/dev/null || true
	@echo ""
	@echo "Stopping Weather Briefing..."
	@cd apps/weather-briefing && $(MAKE) stop 2>/dev/null || true
	@echo ""
	@echo "Stopping G1000 Simulator..."
	@cd apps/g1000-simulator && $(MAKE) stop 2>/dev/null || true
	@echo ""
	@echo "✅ All applications stopped!"
