# Build context is the repo root (see railway.toml / dockerfilePath).
FROM node:20-alpine AS frontend-build

WORKDIR /app

# The frontend depends on workspace packages via the "workspace:" protocol,
# which npm cannot resolve (EUNSUPPORTEDPROTOCOL). Use the pinned pnpm.
RUN corepack enable pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
# The lockfile describes every workspace member, so they must all be present
# for --frozen-lockfile to succeed.
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile --filter g1000-simulator-frontend...
RUN pnpm --filter g1000-simulator-frontend... run build


FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY apps/g1000-simulator/backend/requirements.txt ./requirements.txt
COPY packages/shared-sdk/python /packages/shared-sdk/python
COPY packages/shared-sdk/data /packages/shared-sdk/data
COPY packages/flight-dynamics /packages/flight-dynamics
COPY packages/g1000-avionics-sdk/python /packages/g1000-avionics-sdk/python

RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

ENV PATH="/opt/venv/bin:$PATH"

COPY apps/g1000-simulator/backend/ /app/backend
COPY --from=frontend-build /app/apps/g1000-simulator/frontend/dist/ /app/backend/static/

WORKDIR /app/backend

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


# Test stage: the backend suites live in two places (backend/tests and
# tests/backend); the Makefile previously ran only the first.
FROM runtime AS testing

RUN /opt/venv/bin/pip install --no-cache-dir pytest pytest-asyncio httpx

WORKDIR /app
COPY apps/g1000-simulator/tests /app/tests

ENV PYTHONPATH=/app/backend
# importlib import mode: tests/backend/ has an __init__.py, so the default
# prepend mode infers the package name "backend" and collides with the real one.
CMD ["pytest", "backend/tests", "tests/backend", "-ra", "--import-mode=importlib"]

# Default deployment image; the testing stage above remains available with --target testing.
FROM runtime AS production
