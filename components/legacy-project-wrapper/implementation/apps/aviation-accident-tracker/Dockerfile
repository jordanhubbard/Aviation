# syntax=docker/dockerfile:1.4

ARG NODE_VERSION=20
ARG BUILDKIT_INLINE_CACHE=1

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

RUN apk add --no-cache python3 make g++ sqlite

# This repo is a pnpm workspace and its packages use the "workspace:" protocol,
# which npm cannot resolve (EUNSUPPORTEDPROTOCOL). Use the pinned pnpm.
RUN corepack enable pnpm

ENV NODE_ENV=development \
    PYTHONUNBUFFERED=1

# Workspace manifests first so dependency installation caches independently of source.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# The lockfile describes every workspace member, so they must all be present
# for --frozen-lockfile to succeed.
COPY packages ./packages
COPY apps ./apps

# The entrypoint addresses the app as /app/backend and /app/frontend; keep those
# stable while the real files live in their workspace locations.
RUN ln -sfn /app/apps/aviation-accident-tracker/backend /app/backend \
    && ln -sfn /app/apps/aviation-accident-tracker/frontend /app/frontend

FROM base AS development

RUN pnpm install --frozen-lockfile \
      --filter @aviation/accident-tracker-backend... \
      --filter @aviation/accident-tracker-frontend...

RUN pnpm --filter @aviation/accident-tracker-backend... run build
RUN pnpm --filter @aviation/accident-tracker-frontend... run build

COPY apps/aviation-accident-tracker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN mkdir -p /app/apps/aviation-accident-tracker/data logs

# 3002 = Backend API (Express), 5173 = Frontend dev server (Vite)
EXPOSE 3002 5173

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/docker-entrypoint.sh"]

FROM development AS testing
ENV NODE_ENV=test
WORKDIR /app/apps/aviation-accident-tracker/backend
ENTRYPOINT []
CMD ["pnpm", "test"]

FROM development AS production
ENV NODE_ENV=production
WORKDIR /app
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
ENTRYPOINT ["/docker-entrypoint.sh"]
