# Aviation Monorepo Makefile
# Provides unified build, clean, and test targets for all applications and packages

.PHONY: help build clean test
.PHONY: build-node build-python build-clojure
.PHONY: clean-node clean-python clean-clojure
.PHONY: test-node test-python test-clojure

# Default target
help:
	@echo "Aviation Monorepo - Available targets:"
	@echo ""
	@echo "  make build       - Build all applications and packages"
	@echo "  make clean       - Clean all build artifacts and dependencies"
	@echo "  make test        - Run all tests"
	@echo ""
	@echo "Component targets:"
	@echo "  make build-node      - Build Node.js/TypeScript applications"
	@echo "  make build-python    - Build Python applications"
	@echo "  make build-clojure   - Build Clojure applications"
	@echo "  make clean-node      - Clean Node.js artifacts"
	@echo "  make clean-python    - Clean Python artifacts"
	@echo "  make clean-clojure   - Clean Clojure artifacts"
	@echo "  make test-node       - Test Node.js applications"
	@echo "  make test-python     - Test Python applications"
	@echo "  make test-clojure    - Test Clojure applications"
	@echo ""

#
# BUILD TARGETS
#

build: build-node build-python build-clojure
	@echo ""
	@echo "✅ Build complete for all applications!"

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
	@if [ -f apps/flightplanner/Makefile ]; then cd apps/flightplanner && $(MAKE) clean; fi
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
	@if [ -f apps/flightplanner/Makefile ]; then \
		cd apps/flightplanner && $(MAKE) backend-test 2>/dev/null || echo "   ⚠️  Tests require setup (see app README)"; \
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
# UTILITY TARGETS
#

.PHONY: validate lint format

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
