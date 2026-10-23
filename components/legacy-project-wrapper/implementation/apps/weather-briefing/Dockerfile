# syntax=docker/dockerfile:1.4

ARG NODE_VERSION=20
ARG BUILDKIT_INLINE_CACHE=1

# Base stage with Node.js + pnpm
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

RUN apk add --no-cache python3 make g++

# This repo is a pnpm workspace and its packages use the "workspace:" protocol,
# which npm cannot resolve (EUNSUPPORTEDPROTOCOL). Use the pinned pnpm.
RUN corepack enable pnpm

ENV NODE_ENV=development \
    PYTHONUNBUFFERED=1

# Workspace manifests first so dependency installation caches independently of source.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Workspace members. The lockfile describes every member, so they must all be
# present for --frozen-lockfile to succeed.
COPY packages ./packages
COPY apps ./apps

# Development stage
FROM base AS development

RUN pnpm install --frozen-lockfile --filter @aviation/weather-briefing...

# Build the service and the workspace packages it depends on.
RUN pnpm --filter @aviation/weather-briefing... run build

WORKDIR /app/apps/weather-briefing
RUN mkdir -p logs

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node.*dist/index.js" || exit 1

CMD ["node", "dist/index.js"]

# Testing stage
FROM development AS testing
ENV NODE_ENV=test
WORKDIR /app/apps/weather-briefing
CMD ["pnpm", "test"]

# Production stage
FROM development AS production
ENV NODE_ENV=production
WORKDIR /app
RUN pnpm prune --prod || true
WORKDIR /app/apps/weather-briefing
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pgrep -f "node.*dist/index.js" || exit 1
CMD ["node", "dist/index.js"]
