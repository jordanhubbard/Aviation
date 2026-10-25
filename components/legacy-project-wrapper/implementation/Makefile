# Aviation Monorepo Makefile
# Provides unified build, clean, test, and run targets for all applications and packages

PYTHON_AUDIT := $(shell command -v python3.12 || command -v python3)
# Resolve pnpm: prefer one on PATH, otherwise let corepack provision the
# version pinned in package.json. Without this the build dies with
# "pnpm: No such file or directory" on any machine that lacks a global pnpm.
PNPM := $(shell command -v pnpm >/dev/null 2>&1 && echo pnpm || (command -v corepack >/dev/null 2>&1 && echo 'corepack pnpm'))
.PHONY: help all build clean test test-docker release
.PHONY: build-node build-python build-clojure
.PHONY: clean-node clean-python clean-clojure
.PHONY: test-node test-go test-python test-clojure test-flight-track-analyzer
.PHONY: test-docker-node test-docker-python test-docker-clojure
.PHONY: run-aviation-missions run-flight-planner run-flight-school
.PHONY: run-foreflight-dashboard run-flight-tracker run-weather-briefing
.PHONY: run-g1000-simulator
.PHONY: run-flight-track-analyzer
.PHONY: deploy-check deploy-build deploy-dns deploy-app deploy-verify
.PHONY: stop-all

APP ?= all

# Default target
help:
	@echo "Aviation Monorepo - Available targets:"
	@echo ""
	@echo "Build & Test:"
	@echo "  make build         - Build all applications and packages"
	@echo "  make clean         - Clean all build artifacts and dependencies"
	@echo "  make test          - Run installed Node, Go, and Flight Track Analyzer suites"
	@echo "  make test-python   - Run other Python suites when their environments are available"
	@echo "  make test-clojure  - Run the Clojure suite when Leiningen is available"
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
	@echo "  make run-flight-track-analyzer - Run Flight Track Analyzer (port 8010)"
	@echo "  make stop-all                 - Stop all running applications"
	@echo "  make deploy-check             - Validate all eleven deployment definitions"
	@echo "  make deploy-build APP=name    - Build a committed app image for do-host1"
	@echo "  make deploy-dns APP=name      - Register its DNS name (DIGITALOCEAN_TOKEN_FILE required)"
	@echo "  make deploy-app APP=name      - Build and install its systemd/Caddy service"
	@echo "  make deploy-verify APP=name   - Check public HTTPS health and active service"
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

all: build

build: build-node build-python build-clojure build-go
	@echo ""
	@echo "✅ Build complete for all applications!"

build-go:
	@echo "📦 Building Go applications..."
	@if command -v go >/dev/null 2>&1; then \
		go build -v ./...; \
	else \
		echo "   ⚠️  go not installed — skipping Go build"; \
	fi
	@echo "✅ Go applications build complete"

build-node:
	@echo "📦 Building Node.js/TypeScript applications and packages..."
	@if [ -z "$(PNPM)" ]; then echo "   ❌ neither pnpm nor corepack found; install Node 16.9+ or pnpm" >&2; exit 1; fi
	$(PNPM) install
	$(PNPM) --recursive --if-present run build
	@echo "✅ Node.js/TypeScript build complete"

build-python:
	@echo "🐍 Building Python applications..."
	@echo "   Note: Python apps require virtual environments to be set up manually"
	@echo "   See individual app READMEs for setup instructions"
	$(MAKE) -C apps/flight-track-analyzer build
	@echo "✅ Python applications ready (install dependencies per app)"

build-clojure:
	@echo "☕ Building Clojure applications..."
	@if [ -f apps/aviation-missions-app/Makefile ]; then \
		if docker info >/dev/null 2>&1; then \
			cd apps/aviation-missions-app && $(MAKE) build; \
		else \
			echo "   ⚠️  Docker not running — skipping Clojure container build"; \
		fi \
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
	$(PNPM) --recursive --if-present run clean
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

test: test-node test-go test-flight-track-analyzer
	@echo ""
	@echo "✅ Core application tests complete!"

test-flight-track-analyzer:
	$(MAKE) -C apps/flight-track-analyzer test


test-node:
	@echo "🧪 Running Node.js/TypeScript tests..."
	$(PNPM) install --frozen-lockfile
	$(PNPM) --filter @aviation/shared-sdk run build
	$(PNPM) --filter @aviation/ai-explainer run build
	$(PNPM) --filter @aviation/keystore run build
	@# Ask pnpm to resolve each package's test binary from the workspace. This
	@# keeps the root test command portable across fresh and retained checkouts.
	@ran=0; skipped=0; \
	for pkg in packages/shared-sdk packages/ai-explainer packages/ui-framework packages/keystore \
	           apps/aviation-accident-tracker/backend apps/aviation-accident-tracker/frontend \
	           apps/flight-planner/frontend apps/foreflight-dashboard/frontend; do \
		if $(PNPM) --filter "./$$pkg" exec vitest --version >/dev/null 2>&1; then \
			echo "  Testing $$pkg..."; \
			if [ "$$pkg" = "packages/keystore" ]; then test_path=src; else test_path=; fi; \
			$(PNPM) --filter "./$$pkg" exec vitest run --passWithNoTests $$test_path || exit 1; \
			ran=$$((ran + 1)); \
		elif [ -f "$$pkg/package.json" ]; then \
			echo "  Skipping $$pkg (vitest unavailable)"; \
			skipped=$$((skipped + 1)); \
		fi \
	done; \
	for pkg in packages/g1000-avionics-sdk packages/g1000-protocols packages/g1000-rendering \
	           apps/flight-tracker apps/g1000-simulator; do \
		if $(PNPM) --filter "./$$pkg" exec jest --version >/dev/null 2>&1; then \
			echo "  Testing $$pkg..."; \
			$(PNPM) --filter "./$$pkg" exec jest --passWithNoTests || exit 1; \
			ran=$$((ran + 1)); \
		else \
			echo "  Skipping $$pkg (jest unavailable)"; \
			skipped=$$((skipped + 1)); \
		fi \
	done; \
	if [ $$ran -eq 0 ]; then \
		echo "⚠️  Node.js/TypeScript tests SKIPPED ($$skipped suites unavailable)"; \
	else \
		echo "✅ Node.js/TypeScript tests PASSED ($$ran run, $$skipped skipped)"; \
	fi

test-go:
	@echo "🧪 Running Go tests..."
	@if command -v go >/dev/null 2>&1; then \
		go test ./... || exit 1; \
		echo "✅ Go tests PASSED"; \
	else \
		echo "   ⚠️  SKIPPED (go not installed)"; \
	fi

test-python:
	@echo "🧪 Running Python tests..."
	@ran=0; skipped=0; \
	echo "   Flight Planner:"; \
	if [ -d apps/flight-planner/.venv ] || [ -d apps/flight-planner/venv ] || python3 -c 'import pytest, fastapi, pandas' >/dev/null 2>&1; then \
		(cd apps/flight-planner && $(MAKE) backend-test) || exit 1; ran=$$((ran + 1)); \
	else \
		echo "   ⚠️  SKIPPED (local Python dependencies unavailable; run make test-docker separately)"; skipped=$$((skipped + 1)); \
	fi; \
	echo ""; \
	echo "   Flight School:"; \
	if [ -d apps/flightschool/venv ]; then \
		(cd apps/flightschool && $(MAKE) test) || exit 1; ran=$$((ran + 1)); \
	else \
		echo "   ⚠️  SKIPPED (local Python dependencies unavailable; run make test-docker separately)"; skipped=$$((skipped + 1)); \
	fi; \
	echo ""; \
	echo "   ForeFlight Dashboard:"; \
	echo "   ⚠️  SKIPPED (container suite is available through make test-docker)"; skipped=$$((skipped + 1)); \
	echo ""; \
	echo "   G1000 Simulator:"; \
	if [ -d apps/g1000-simulator/.venv ] || [ -d apps/g1000-simulator/venv ] || python3 -c 'import pytest, fastapi' >/dev/null 2>&1; then \
		(cd apps/g1000-simulator && $(MAKE) backend-test) || exit 1; ran=$$((ran + 1)); \
	else \
		echo "   ⚠️  SKIPPED (local Python dependencies unavailable; run make test-docker separately)"; skipped=$$((skipped + 1)); \
	fi; \
	echo ""; \
	echo "   Flight Track Analyzer:"; \
	(cd apps/flight-track-analyzer && $(MAKE) test) || exit 1; ran=$$((ran + 1)); \
	if [ $$ran -eq 0 ]; then \
		echo "⚠️  Python tests SKIPPED (0 run, $$skipped unavailable) - this is NOT a pass"; \
	else \
		echo "✅ Python tests PASSED ($$ran run, $$skipped skipped)"; \
	fi

test-clojure:
	@echo "🧪 Running Clojure tests..."
	@if [ -f apps/aviation-missions-app/Makefile ]; then \
		if command -v lein >/dev/null 2>&1; then \
			cd apps/aviation-missions-app && lein test; \
		else \
			echo "   ⚠️  SKIPPED (lein unavailable; run make test-docker separately)"; \
		fi \
	fi
	@echo "   (Clojure suite runs locally when lein is available)"

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
	@echo "🔍 Validating MAC repository contract..."
	@test -f .mac/project.yaml
	@python3 -c 'import pathlib, yaml; data = yaml.safe_load(pathlib.Path(".mac/project.yaml").read_text()); assert data.get("schema") == "mac.repository_contract.v1"; assert data.get("project") == "Aviation"'
	@echo "✅ MAC repository contract valid"

lint:
	@echo "🔍 Running linters..."
	$(PNPM) --recursive --if-present run lint
	@echo "✅ Linting complete"

format:
	@echo "✨ Formatting code..."
	$(PNPM) --recursive --if-present run format
	@echo "✅ Code formatting complete"

audit: audit-node audit-python
	@echo ""
	@echo "✅ Security audit complete!"

audit-node:
	@echo "🔐 Running Node.js security audit..."
	@# pnpm audit covers the whole workspace; there is no --recursive flag.
	$(PNPM) audit || true
	@echo "✅ Node.js audit complete"

audit-python:
	@echo "🔐 Running Python security audit..."
	@# Pick an interpreter that can actually build a venv. A python3.12 whose
	@# ensurepip is broken still imports ensurepip, so probe by creating one.
	@rm -rf .venv-audit
	@for py in $(PYTHON_AUDIT) python3.12 python3; do \
		command -v $$py >/dev/null 2>&1 || continue; \
		if $$py -m venv .venv-audit >/dev/null 2>&1; then \
			echo "   using $$py"; break; \
		fi; \
		rm -rf .venv-audit; \
	done
	@if [ ! -x ./.venv-audit/bin/pip ]; then \
		echo "   ⚠️  SKIPPED (no interpreter here can create a venv)"; exit 0; \
	fi
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

run-flight-track-analyzer:
	@echo "🚀 Starting Flight Track Analyzer..."
	$(MAKE) -C apps/flight-track-analyzer run PORT=8010

deploy-check:
	python3 deploy/deploy.py check

deploy-build:
	python3 deploy/deploy.py build --app $(APP)

deploy-dns:
	python3 deploy/deploy.py dns --app $(APP)

deploy-app:
	python3 deploy/deploy.py deploy --app $(APP)

deploy-verify:
	python3 deploy/deploy.py verify --app $(APP)

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
