FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY apps/flight-planner/frontend/package.json apps/flight-planner/frontend/package-lock.json ./
RUN npm ci

COPY apps/flight-planner/frontend/ ./
RUN npm run build


FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1


FROM base AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        gdal-bin \
        libgdal-dev \
        proj-bin \
        libproj-dev \
        libgeos-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY apps/flight-planner/requirements.txt ./requirements.txt
COPY packages/shared-sdk/python /packages/shared-sdk/python

RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt


FROM base AS runtime

ARG REPO_URL=""
ARG GIT_SHA=""
ARG BUILD_TIME_UTC=""

LABEL org.opencontainers.image.source=$REPO_URL \
      org.opencontainers.image.revision=$GIT_SHA

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gdal-bin \
        libgdal-dev \
        proj-bin \
        libproj-dev \
        libgeos-dev \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/venv/bin:$PATH"

ENV REPO_URL=$REPO_URL \
    GIT_SHA=$GIT_SHA \
    BUILD_TIME_UTC=$BUILD_TIME_UTC

COPY --from=builder /opt/venv /opt/venv
COPY packages/shared-sdk/python /packages/shared-sdk/python
COPY packages/keystore/python /packages/keystore/python

# Optional: include Beads issue tracker and CLI for local error auto-reporting.
ARG INSTALL_BD=false
RUN if [ "$INSTALL_BD" = "true" ]; then \
      apt-get update && apt-get install -y --no-install-recommends curl bash ca-certificates && \
      rm -rf /var/lib/apt/lists/* && \
      curl -sSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash ; \
    fi

WORKDIR /app
COPY apps/flight-planner/.beads/ ./.beads/

WORKDIR /app/backend
COPY apps/flight-planner/backend/ ./
COPY --from=frontend-build /app/frontend/dist/ /app/backend/static/

EXPOSE 8000

# Bind to IPv4 by default for Railway compatibility; can be overridden (e.g. UVICORN_HOST=::).
ENV UVICORN_HOST=0.0.0.0

# Railway routes to the service's configured port (derived from EXPOSE). Avoid relying on Railway's
# PORT env var here to prevent mismatches.
ENV UVICORN_PORT=8000

CMD ["sh", "-c", "uvicorn main:app --host ${UVICORN_HOST:-0.0.0.0} --port ${PORT:-${UVICORN_PORT:-8000}} --workers ${UVICORN_WORKERS:-1}"]
