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

RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

ENV PATH="/opt/venv/bin:$PATH"

COPY apps/g1000-simulator/backend/ /app/backend
COPY --from=frontend-build /app/apps/g1000-simulator/frontend/dist/ /app/backend/static/

WORKDIR /app/backend

EXPOSE 8000


# Test stage: the backend suites live in two places (backend/tests and
# tests/backend); the Makefile previously ran only the first.
FROM runtime AS testing

COPY packages/flight-dynamics/requirements.txt /tmp/flight-dynamics-requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir pytest pytest-asyncio httpx \
    && /opt/venv/bin/pip install --no-cache-dir -r /tmp/flight-dynamics-requirements.txt

WORKDIR /app
COPY apps/g1000-simulator/tests /app/tests

# tests/backend/test_autopilot_package.py exercises the shared flight-dynamics
# package, which is not part of the runtime image.
COPY packages/flight-dynamics /app/packages/flight-dynamics

ENV PYTHONPATH=/app/backend:/app/packages/flight-dynamics
# importlib import mode: tests/backend/ has an __init__.py, so the default
# prepend mode infers the package name "backend" and collides with the real one.
CMD ["pytest", "backend/tests", "tests/backend", "-ra", "--import-mode=importlib"]
