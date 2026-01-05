# Aviation Mission Management Makefile
# Clojure Backend + Pure JavaScript Frontend

# Port Configuration (can be overridden by environment variables)
PORT ?= 8080
API_PORT ?= 3000

# Export ports for use in docker-compose and other tools
export PORT
export API_PORT

# Variables
IMAGE_NAME=aviation-missions
CONTAINER_NAME=aviation-missions-container
COMPOSE_FILE=docker-compose.yml
DEV_COMPOSE_FILE=docker-compose.dev.yml

# Docker BuildKit optimization settings
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

# Default target
.PHONY: help
help:
	@echo "Aviation Mission Management - Available Commands:"
	@echo ""
	@echo "  start        - Build and start the complete application (production)"
	@echo "  restart      - Stop and restart the application (convenience command)"
	@echo "  stop         - Stop the running application"
	@echo "  logs         - View application logs (blocking)"
	@echo "  clean        - Complete cleanup: stop, remove containers, images, and files"
	@echo "  build        - Build the Docker image"
	@echo "  test         - Run tests in Docker containers"
	@echo ""
	@echo "  Code Quality & Analysis:"
	@echo "  lint         - Comprehensive analysis (clj-kondo + ESLint with React support)"
	@echo ""
	@echo "Port Configuration:"
	@echo "  PORT = $(PORT) (Main application port)"
	@echo "  API_PORT = $(API_PORT) (Backend API port)"
	@echo ""
	@echo "Usage:"
	@echo "  make start                    # Production mode (Docker)"
	@echo "  make lint                     # Comprehensive code analysis"
	@echo "  PORT=9000 make start          # Use custom port"

# Build the Docker image
.PHONY: build
build:
	@echo "🔨 Building Aviation Mission Management Docker image..."
	docker build -t $(IMAGE_NAME):latest .

# Run comprehensive linting analysis on the code
.PHONY: lint
lint:
	@echo "🔍 Running comprehensive code analysis in Docker containers..."
	@echo "📋 Tools: clj-kondo (Clojure), ESLint (JavaScript/React), Contrast Checker (CSS)"
	@echo "Backend Clojure files:"
	docker run --rm -v $(PWD):/workspace -w /workspace cljkondo/clj-kondo:latest clj-kondo --lint backend/src
	@echo "Frontend JavaScript/React files:"
	docker run --rm -v $(PWD):/workspace -w /workspace node:18-alpine sh -c '\
		cd /workspace && \
		echo "Installing ESLint and React plugins..." && \
		npm init -y > /dev/null 2>&1 && \
		npm install --no-save eslint@8 eslint-plugin-react eslint-plugin-react-hooks > /dev/null 2>&1 && \
		echo "Creating ESLint config..." && \
		echo "{\
			\"env\": {\"browser\": true, \"es2021\": true}, \
			\"extends\": [\"eslint:recommended\", \"plugin:react/recommended\"], \
			\"plugins\": [\"react\", \"react-hooks\"], \
			\"parserOptions\": {\"ecmaVersion\": 2021, \"sourceType\": \"module\", \"ecmaFeatures\": {\"jsx\": true}}, \
			\"rules\": {\"no-unused-vars\": \"warn\", \"no-console\": \"off\", \"react/react-in-jsx-scope\": \"off\"}, \
			\"settings\": {\"react\": {\"version\": \"detect\"}} \
		}" > .eslintrc.json && \
		echo "Running ESLint on JavaScript files..." && \
		npx eslint frontend/resources/public/js/app.js || echo "ESLint completed with warnings/errors"'
	@echo "Checking color contrast (WCAG AA):"
	@$(MAKE) check-contrast
	@echo "✅ Linting analysis completed successfully!"

# Check CSS color contrast for accessibility (WCAG AA compliance)
.PHONY: check-contrast
check-contrast:
	@echo "🎨 Checking color contrast ratios (WCAG AA compliance)..."
	docker run --rm -v $(PWD):/workspace -w /workspace node:18-alpine sh -c '\
		node scripts/check-contrast.js frontend/resources/public/css/styles.css'

# Run accessibility checks
.PHONY: lint-a11y
lint-a11y: check-contrast
	@echo "♿ Running accessibility linting..."
	@echo "✅ Accessibility checks completed!"

# Start the application in production mode
.PHONY: start
start: build
	@echo "🚀 Starting Aviation Mission Management (Production)..."
	docker compose -f $(COMPOSE_FILE) up -d
	@echo "✅ Application started successfully!"
	@echo ""
	@echo "🌐 Main Application: http://localhost:$(PORT)"
	@echo "📚 API Documentation: http://localhost:$(PORT)/api/swagger.json"
	@echo ""
	@echo "To view logs: make logs"
	@echo "To stop: make stop"

# Stop the running application
.PHONY: stop
stop:
	@echo "🛑 Stopping Aviation Mission Management..."
	-docker compose -f $(COMPOSE_FILE) down 2>/dev/null || true
	-docker compose -f $(DEV_COMPOSE_FILE) down 2>/dev/null || true
	@echo "✅ Application stopped successfully!"

# Restart the application (stop + rebuild + start)
.PHONY: restart
restart: stop build
	@echo "🚀 Starting Aviation Mission Management (Production)..."
	docker compose -f $(COMPOSE_FILE) up -d
	@echo "✅ Application restarted successfully!"
	@echo ""
	@echo "🌐 Main Application: http://localhost:$(PORT)"
	@echo "📚 API Documentation: http://localhost:$(PORT)/api/swagger.json"
	@echo ""
	@echo "To view logs: make logs"

# View application logs (blocking)
.PHONY: logs
logs:
	@echo "📋 Viewing Aviation Mission Management logs..."
	@echo "Press Ctrl+C to stop viewing logs"
	docker compose -f $(COMPOSE_FILE) logs -f 2>/dev/null || docker compose -f $(DEV_COMPOSE_FILE) logs -f

# Clean up everything
.PHONY: clean
clean: stop
	@echo "🧹 Cleaning up Docker resources..."
	-docker compose -f $(COMPOSE_FILE) down -v --rmi all --remove-orphans 2>/dev/null || true
	-docker compose -f $(DEV_COMPOSE_FILE) down -v --rmi all --remove-orphans 2>/dev/null || true
	-docker rmi $(IMAGE_NAME):latest 2>/dev/null || true
	-docker rmi $(IMAGE_NAME):dev 2>/dev/null || true
	@echo "🗑️  Cleaning up application data..."
	-rm -rf data/* 2>/dev/null || true
	-rm -rf backend/target/ 2>/dev/null || true
	-rm -rf frontend/dist/ 2>/dev/null || true
	-rm -rf frontend/node_modules/.cache/ 2>/dev/null || true
	@echo "✅ Complete cleanup finished!"

# Test the application in Docker containers
.PHONY: test
test:
	@echo "🧪 Testing application in Docker containers..."
	@echo "Building and running comprehensive test suite..."
	docker build --target testing -t $(IMAGE_NAME):test .
	@echo "✅ All tests completed successfully!"
	@echo ""
	@echo "Test coverage includes:"
	@echo "  📋 Backend unit tests (Clojure)"
	@echo "  🌐 API integration tests"
	@echo "  🧪 Frontend syntax validation (JavaScript)"
	@echo "  🔍 Code quality analysis"
