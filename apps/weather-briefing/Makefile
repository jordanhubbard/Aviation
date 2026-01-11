# Weather Briefing Makefile
# Aviation weather briefing with AI-powered analysis (TypeScript/Node.js)

.PHONY: help install build start stop clean test lint

PORT ?= 3002

help:
	@echo "Weather Briefing - Available Commands:"
	@echo ""
	@echo "  make start       - Install dependencies, build, and start the service"
	@echo "  make install     - Install Node.js dependencies"
	@echo "  make build       - Build TypeScript to JavaScript"
	@echo "  make stop        - Stop the running service"
	@echo "  make clean       - Remove all build artifacts and dependencies"
	@echo "  make test        - Run tests"
	@echo "  make lint        - Run linting checks"
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
