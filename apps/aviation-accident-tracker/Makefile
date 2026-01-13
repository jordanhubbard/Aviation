.PHONY: help build clean test start

help:
	@echo "Aviation Accident Tracker"
	@echo "  make build   - Build backend and frontend (placeholders)"
	@echo "  make clean   - Remove build artifacts"
	@echo "  make test    - Run tests (placeholder)"
	@echo "  make start   - Start backend (placeholder)"

build:
	cd backend && npm install && npm run build || true
	cd frontend && npm install && npm run build || true

clean:
	cd backend && npm run clean || true
	cd frontend && npm run clean || true

test:
	cd backend && npm test || true
	cd frontend && npm test || true

start:
	cd backend && npm start || true
