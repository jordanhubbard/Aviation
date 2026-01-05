.PHONY: help \
	dev-up dev-down dev-logs dev-build \
	prod-up prod-down prod-logs prod-build \
	backend-test backend-format backend-format-check backend-lint backend-typecheck \
	frontend-install frontend-typecheck frontend-lint frontend-test frontend-e2e frontend-format frontend-format-check \
	clean

help:
	@echo "Targets:"
	@echo "  dev-up/dev-down/dev-logs/dev-build        Run local dev via docker-compose.yml"
	@echo "  prod-up/prod-down/prod-logs/prod-build    Run prod via docker-compose.prod.yml"
	@echo "  backend-test/backend-format/backend-lint/backend-typecheck"
	@echo "  frontend-install/frontend-typecheck/frontend-lint/frontend-test/frontend-e2e"
	@echo "  clean"

dev-up:
	docker compose up

dev-down:
	docker compose down

dev-logs:
	docker compose logs -f

dev-build:
	docker compose build

prod-up:
	docker compose -f docker-compose.prod.yml up -d

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-build:
	docker compose -f docker-compose.prod.yml build

backend-test:
	.venv/bin/python -m pytest

backend-format:
	.venv/bin/python -m black backend tests scripts

backend-format-check:
	.venv/bin/python -m black --check backend tests scripts

backend-lint:
	.venv/bin/python -m flake8 backend tests scripts

backend-typecheck:
	.venv/bin/python -m mypy --config-file pyproject.toml backend

frontend-install:
	cd frontend && npm install

frontend-typecheck:
	cd frontend && npm run type-check

frontend-lint:
	cd frontend && npm run lint

frontend-test:
	cd frontend && npm run test

frontend-e2e:
	cd frontend && npm run e2e

frontend-format:
	cd frontend && npm run format

frontend-format-check:
	cd frontend && npm run format:check

clean:
	rm -rf frontend/test-results frontend/playwright-report
