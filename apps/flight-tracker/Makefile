# Flight Tracker Makefile
# Real-time flight tracking service (TypeScript/Node.js)

.PHONY: help install build start stop clean test lint docker-build docker-up docker-down docker-test test-docker docker-logs

PORT ?= 3001

help:
	@echo "Flight Tracker - Available Commands:"
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
	@echo "  PORT=4001 make start          # Start on custom port"

install:
	@echo "📦 Installing dependencies for Flight Tracker..."
	npm install
	@echo "✅ Dependencies installed!"

build: install
	@echo "🔨 Building Flight Tracker..."
	npm run build
	@echo "✅ Build complete!"

start: build
	@echo "🚀 Starting Flight Tracker on port $(PORT)..."
	@echo ""
	@echo "🌐 Service: http://localhost:$(PORT)"
	@echo ""
	@echo "Press Ctrl+C to stop the service"
	PORT=$(PORT) npm start

stop:
	@echo "🛑 Stopping Flight Tracker..."
	@pkill -f "node.*flight-tracker" || true
	@echo "✅ Service stopped!"

clean:
	@echo "🧹 Cleaning Flight Tracker..."
	rm -rf node_modules
	rm -rf dist
	rm -f tsconfig.tsbuildinfo
	@echo "✅ Cleanup complete!"

test:
	@echo "🧪 Running Flight Tracker tests..."
	npm test
	@echo "✅ Tests complete!"

lint:
	@echo "🔍 Running Flight Tracker linting..."
	npm run lint
	@echo "✅ Linting complete!"

# Docker targets
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d
	@echo "✅ Flight Tracker started in Docker!"
	@echo "🚀 Service: http://localhost:$(PORT)"

docker-down:
	docker-compose down

docker-test: test-docker

test-docker:
	@echo "🧪 Running tests in Docker..."
	docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
	docker-compose -f docker-compose.test.yml down -v

docker-logs:
	docker-compose logs -f
