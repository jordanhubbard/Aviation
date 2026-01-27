# G1000 Simulator Makefile
# Minimal build/test/run targets for backend and frontend scaffolds

.PHONY: help start start-backend start-frontend stop build build-backend build-frontend
.PHONY: test test-backend test-frontend lint lint-frontend clean backend-setup frontend-install

PYTHON ?= python3
VENV ?= .venv
BACKEND_DIR := backend
FRONTEND_DIR := frontend
BACKEND_PORT ?= 8005
FRONTEND_PORT ?= 5175

help:
	@echo "G1000 Simulator - Available Commands:"
	@echo ""
	@echo "Local Development:"
	@echo "  make start          - Show how to run backend + frontend"
	@echo "  make start-backend  - Start FastAPI backend"
	@echo "  make start-frontend - Start Vite frontend"
	@echo "  make build          - Build backend (stub) + frontend"
	@echo "  make test           - Run backend + frontend tests"
	@echo "  make lint           - Run frontend lint"
	@echo "  make clean          - Remove build artifacts and venv"
	@echo ""
	@echo "Ports:"
	@echo "  BACKEND_PORT=$(BACKEND_PORT)"
	@echo "  FRONTEND_PORT=$(FRONTEND_PORT)"

start:
	@echo "Start backend and frontend in separate terminals:"
	@echo "  make start-backend"
	@echo "  make start-frontend"

backend-setup:
	@if [ ! -d $(VENV) ]; then \
		$(PYTHON) -m venv $(VENV); \
	fi
	@$(VENV)/bin/python -m pip install -r $(BACKEND_DIR)/requirements.txt

frontend-install:
	@cd $(FRONTEND_DIR) && npm install

start-backend: backend-setup
	@echo "🚀 Starting G1000 backend on port $(BACKEND_PORT)..."
	@$(VENV)/bin/python -m uvicorn main:app --reload --port $(BACKEND_PORT) --app-dir $(BACKEND_DIR)

start-frontend: frontend-install
	@echo "🚀 Starting G1000 frontend on port $(FRONTEND_PORT)..."
	@cd $(FRONTEND_DIR) && npm run dev -- --port $(FRONTEND_PORT)

build: build-backend build-frontend
	@echo "✅ Build complete"

build-backend: backend-setup
	@echo "✅ Backend ready (FastAPI runs without a build step)"

build-frontend: frontend-install
	@cd $(FRONTEND_DIR) && npm run build

test: test-backend test-frontend
	@echo "✅ Tests complete"

test-backend: backend-setup
	@$(VENV)/bin/python -m pytest $(BACKEND_DIR)/tests

test-frontend: frontend-install
	@cd $(FRONTEND_DIR) && npm run test

lint: lint-frontend

lint-frontend: frontend-install
	@cd $(FRONTEND_DIR) && npm run lint

stop:
	@echo "Stop the backend/frontend with Ctrl+C in their terminals."

clean:
	@rm -rf $(VENV)
	@rm -rf $(FRONTEND_DIR)/node_modules
	@rm -rf $(FRONTEND_DIR)/dist
