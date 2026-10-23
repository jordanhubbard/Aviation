# Weather Briefing Makefile
# Aviation weather briefing with AI-powered analysis (TypeScript/Node.js)

# Compose v2 ships as a docker plugin ("docker compose"); the standalone
# "docker-compose" binary is absent on modern installs. Prefer the plugin.
COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

.PHONY: help install build start stop clean test lint docker-build docker-up docker-down docker-test test-docker docker-logs

PORT ?= 3003

help:
	@echo "Weather Briefing - Available Commands:"
	@echo ""
	@echo "Local Development:"
	@echo "  make start         - Install dependencies, build, and start the service"
	@echo "  make install       - Install Node.js dependencies"
	@echo "  make build         - Build TypeScript to JavaScript"
	@echo "  make stop          - Stop the running service"
	@echo "  make clean         - Remove all build artifacts and dependencies"
	@echo "  make test          - Run tests locally"
	@echo "  make lint          - Run linting checks"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make docker-build  - Build Docker image"
	@echo "  make docker-up     - Start service in Docker"
	@echo "  make docker-down   - Stop and remove Docker containers"
	@echo "  make docker-test   - Run tests in Docker (recommended)"
	@echo "  make docker-logs   - View Docker container logs"
	@echo ""
	@echo "Port Configuration:"
	@echo "  PORT = $(PORT) (Service port)"
	@echo ""
	@echo "Usage:"
	@echo "  make start                    # Start on default port $(PORT)"
	@echo "  PORT=4002 make start          # Start on custom port"

install:
	@echo "📦 Installing dependencies for Weather Briefing..."
	npm install
	@echo "✅ Dependencies installed!"

build: install
	@echo "🔨 Building Weather Briefing..."
	npm run build
	@echo "✅ Build complete!"

start: build
	@echo "🚀 Starting Weather Briefing on port $(PORT)..."
	@echo ""
	@echo "🌐 Service: http://localhost:$(PORT)"
	@echo ""
	@echo "Press Ctrl+C to stop the service"
	PORT=$(PORT) npm start

stop:
	@echo "🛑 Stopping Weather Briefing..."
	@pkill -f "node.*weather-briefing" || true
	@echo "✅ Service stopped!"

clean:
	@echo "🧹 Cleaning Weather Briefing..."
	rm -rf node_modules
	rm -rf dist
	rm -f tsconfig.tsbuildinfo
	@echo "✅ Cleanup complete!"

test:
	@echo "🧪 Running Weather Briefing tests..."
	npm test
	@echo "✅ Tests complete!"

lint:
	@echo "🔍 Running Weather Briefing linting..."
	npm run lint
	@echo "✅ Linting complete!"

# Docker targets
docker-build:
	$(COMPOSE) build

docker-up:
	$(COMPOSE) up -d
	@echo "✅ Weather Briefing started in Docker!"
	@echo "🚀 Service: http://localhost:$(PORT)"

docker-down:
	$(COMPOSE) down

docker-test: test-docker

test-docker:
	@echo "🧪 Running tests in Docker..."
	$(COMPOSE) -f docker-compose.test.yml up --build --abort-on-container-exit
	$(COMPOSE) -f docker-compose.test.yml down -v

docker-logs:
	$(COMPOSE) logs -f
