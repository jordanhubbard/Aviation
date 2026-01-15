.PHONY: help build clean test start docker-build docker-up docker-down docker-test test-docker

help:
	@echo "Aviation Accident Tracker"
	@echo ""
	@echo "Local Development:"
	@echo "  make build         - Build backend and frontend locally"
	@echo "  make clean         - Remove build artifacts"
	@echo "  make test          - Run tests locally"
	@echo "  make start         - Start backend locally"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make docker-build  - Build Docker image"
	@echo "  make docker-up     - Start services in Docker"
	@echo "  make docker-down   - Stop and remove Docker containers"
	@echo "  make docker-test   - Run tests in Docker (recommended)"
	@echo "  make docker-logs   - View Docker container logs"

# Local development targets
build:
	cd backend && npm install && npm run build
	cd frontend && npm install && npm run build

clean:
	cd backend && npm run clean || true
	cd frontend && npm run clean || true
	rm -rf data/*.db logs/*.log

test:
	cd backend && npm test
	cd frontend && npm test

start:
	cd backend && npm start

# Docker targets
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d
	@echo "✅ Services started!"
	@echo "🎯 Frontend: http://localhost:5173"
	@echo "🔧 Backend: http://localhost:3002"
	@echo "📚 API Docs: http://localhost:3002/api-docs"

docker-down:
	docker-compose down

docker-test: test-docker

test-docker:
	@echo "🧪 Running tests in Docker..."
	docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
	docker-compose -f docker-compose.test.yml down -v

docker-logs:
	docker-compose logs -f
